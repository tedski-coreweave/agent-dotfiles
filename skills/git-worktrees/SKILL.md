---
name: git-worktrees
description: Create, switch, inspect, and clean up Git worktrees with Worktrunk (wt). Use for isolated feature work, parallel work without branch switching, PR review, or removing and pruning worktrees after a merge.
---

# Git worktrees

Prefer Worktrunk (`wt`) for worktree operations. Use Git directly when `wt`
is unavailable or for operations Worktrunk does not cover. Repository
instructions and approval gates still apply.

## Inspect and create

```bash
wt list                         # Worktrees, paths, and status
wt list --full                  # Include PR and CI information
wt config show                  # Configuration and worktree path
wt hook show                    # Commands that may run on switch or removal
wt switch --create tedski/feat/my-feature
wt switch --create tedski/fix/my-fix --base origin/main
wt switch tedski/fix/existing   # Existing local or remote branch
wt switch pr:123                # Existing PR branch
```

Use the actual base requested by the task. `--create` defaults to the
repository's default branch, not the current HEAD; use `--base @` to branch
from the current worktree. Refresh remote refs only when appropriate. Branch
names follow `tedski/{fix,feat,chore}/<short-name>`.

Worktree paths come from Worktrunk configuration, not a fixed `.worktrees/`
layout. Find the actual path with `wt list` or `git worktree list --porcelain`.
`wt switch` needs shell integration to change an interactive shell's directory;
a subprocess cannot change the agent's working directory. Use the discovered
path explicitly with `cd` or `git -C` in subsequent commands. For automation,
`wt switch --no-cd --format json` emits a structured result; consult the
installed `wt switch --help` for its current options.

Switching can run user and project hooks, including background hooks. Inspect
`wt hook show` and repository setup instructions before running them. Do not
bypass hook approval prompts with `--yes`. If a hook would violate a safety
gate or its effects are unclear, resolve that first; `--no-hooks` is available
when skipping setup is appropriate. Follow the repository's documented setup,
including submodule initialization where needed. Never update submodule
pointers unless that is the task.

Do not blanket-copy ignored files or run `wt step copy-ignored`: they may
contain credentials. If setup requires a specific file, copy only that file
deliberately from the main worktree after checking the source and destination.

## Remove

Inspect the target's work, including untracked and ignored files that removal
would discard. Check nested submodules for local work too. Never remove a dirty
worktree without confirmation, and never discard local work implicitly.

```bash
wt list
git -C <worktree-path> status --short --untracked-files=all
git -C <worktree-path> status --short --ignored
wt hook show
wt remove --foreground --no-delete-branch <branch-or-path>
```

`wt remove` normally deletes a branch it considers integrated, including
squash-merged branches. Use `--no-delete-branch` to preserve it, particularly
for unmerged work. Delete a merged branch separately only when cleanup is in
scope. Removal normally runs in the background; `--foreground` waits for the
result. Do not use `--force`, `--force-delete`, `--reap`, or bulk
`wt step prune` without understanding and authorization for their effects.

For a stale worktree whose directory is already gone, inspect
`git worktree list --porcelain`, then use `git worktree prune` as appropriate.
For a locked worktree or an occupied target path, investigate the owner and
contents instead of forcing removal or creation.

## Integration

`wt merge` can commit, rebase, squash, merge, run hooks, and remove the
worktree. It is not a shortcut around the explicit approval gate for merging,
pushing, or external posts. Inspect `wt merge --help` and configured hooks
before using it, and use only the operations authorized for the task.

For submodule fetch failures in linked worktrees, use the
`git-worktree-submodule-fetch-repair` skill.
