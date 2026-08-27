---
name: git-worktree-submodule-fetch-repair
description: "Diagnose and repair git fetch --all failures caused by broken submodule state inside linked worktrees, especially errors like 'origin does not appear to be a git repository' or 'Unable to find current revision in submodule path'."
metadata:
  author: "Brian Lalor <blalor@bravo5.org>"
---

# Git worktree submodule fetch repair

Use this when `git fetch --all` fails in a linked worktree while fetching a submodule.

Common symptoms:

```text
Fetching submodule <path>
fatal: 'origin' does not appear to be a git repository
fatal: Could not read from remote repository.
Errors during submodule fetch:
    <path>
```

or, after `git submodule deinit`:

```text
fatal: Unable to find current revision in submodule path '<path>'
```

## Safety rules

- Do not modify anything during investigation unless the user asks for a repair.
- Before destructive cleanup, check whether the submodule contains local work.
- Do not remove the shared healthy submodule repository under the main worktree unless you have proved it is the corrupt one.
- In a linked worktree, the broken per-worktree submodule gitdir is usually under:

```text
$(git rev-parse --git-dir)/modules/<submodule-path>
```

where `git rev-parse --git-dir` from the linked worktree resolves to the per-worktree path:

```text
/path/to/main/.git/worktrees/<linked-worktree-name>
```

Do not confuse it with `git rev-parse --git-common-dir`, which resolves to the SHARED `/path/to/main/.git`; its `modules/` holds the healthy submodule state for every worktree and must never be deleted by this procedure.

## Investigation

Start in the failing worktree.

Confirm the top-level remote and submodule configuration:

```bash
git remote -v
git config --file .gitmodules --get-regexp 'submodule\..*\.(path|url)' || true
git config --get-regexp '^submodule\..*\.(path|url|active)$' || true
```

Run the failing command and capture the exact submodule path:

```bash
git fetch --all
```

Inspect the submodule. Replace `libs/example-submodule` with the failing path:

```bash
sub=libs/example-submodule

git submodule status --recursive -- "$sub"
ls -la "$sub"
test -e "$sub/.git" && sed -n '1,5p' "$sub/.git" || printf 'submodule .git absent\n'

git -C "$sub" remote -v || true
git -C "$sub" remote get-url origin || true
git -C "$sub" rev-parse --git-dir --git-common-dir HEAD 2>&1 || true
git -C "$sub" status --short --branch --untracked-files=no 2>&1 || true
```

Interpretation:

- `git submodule status` with a leading `-` means the submodule is not initialized. That state may print warnings during fetch, but often exits `0`.
- If `$sub/.git` exists and points into `.git/worktrees/<name>/modules/...`, Git treats the submodule as initialized in this worktree.
- If the submodule gitdir has no `remote.origin.url`, recursive fetch can fail with `origin does not appear to be a git repository`.
- If `HEAD` cannot resolve, `git submodule update --init` can fail with `Unable to find current revision in submodule path`.
- A `HEAD` file containing `ref: refs/heads/.invalid` can be a valid reftable stub in some repositories, but in the broken case there is no corresponding ref storage or valid `HEAD` resolution.

Compare with the main worktree if needed:

```bash
git worktree list --porcelain
main=/path/to/main/worktree

git -C "$main/$sub" remote -v || true
git -C "$main/$sub" rev-parse --short HEAD || true
git -C "$main/$sub" config --local --list --show-origin | grep -E '(remote\.origin|core\.worktree)' || true
```

Also inspect the per-worktree and shared submodule gitdirs:

```bash
sub=libs/example-submodule
subgitdir=$(git -C "$sub" rev-parse --git-dir 2>/dev/null || true)
printf 'subgitdir=%s\n' "$subgitdir"

test -n "$subgitdir" && find "$subgitdir" -maxdepth 2 -type f -print | sort | head -80

git_dir=$(git rev-parse --git-dir)
git_common=$(git rev-parse --git-common-dir)
printf 'per-worktree gitdir=%s\n' "$git_dir"
printf 'shared common dir (do not delete from)=%s\n' "$git_common"
printf 'candidate per-worktree submodule gitdir=%s\n' "$git_dir/modules/$sub"
```

## Repair path

First try the normal repair:

```bash
sub=libs/example-submodule

git submodule deinit -f -- "$sub"
git submodule sync -- "$sub"
git submodule update --init --progress -- "$sub"
git fetch --all
```

If that fails with `Unable to find current revision in submodule path`, remove the broken per-worktree checkout and its per-worktree gitdir, then initialize again:

```bash
sub=libs/example-submodule

# Capture this before deleting the working tree.
subgitdir=$(git -C "$sub" rev-parse --git-dir)
printf 'removing submodule worktree: %s\n' "$sub"
printf 'removing submodule gitdir: %s\n' "$subgitdir"

# Optional safety check. This may fail when the submodule is already corrupt.
git -C "$sub" status --short --branch 2>&1 || true

# Guard: only a per-worktree submodule gitdir is safe to delete. Anything
# else (notably <shared .git>/modules/<sub>) is shared state for every
# worktree, and deleting it converts one broken worktree into all of them.
case "$subgitdir" in
  */.git/worktrees/*/modules/*) ;;
  *)
    printf 'REFUSING to delete %s: not a per-worktree submodule gitdir\n' "$subgitdir" >&2
    exit 1
    ;;
esac

rm -rf "$sub" "$subgitdir"

git submodule sync -- "$sub"
git submodule update --init --progress -- "$sub"
git fetch --all
```

Expected result:

- `$sub/.git` is recreated.
- `git -C "$sub" remote -v` shows the configured submodule remote, for example `git@github.com:wandb/weave.git`.
- `git fetch --all` exits `0`.

## Worktrunk context

A freshly created Worktrunk worktree does not necessarily initialize submodules. If the repository's hooks skip submodule update, a new worktree may have an empty submodule directory and no `$sub/.git`. That state is different from a partially initialized submodule.

For Worktrunk-created worktrees, check:

```bash
wt --version
wt config show
git submodule status --recursive
```

If a fresh Worktrunk worktree has an uninitialized submodule, `git fetch --all` may print a warning like:

```text
Could not access submodule '<path>' at commit <short-sha>
```

and still exit `0`. The hard failure happens when the submodule is initialized enough for Git to recurse into it, but its per-worktree gitdir is missing `origin` or cannot resolve `HEAD`.
