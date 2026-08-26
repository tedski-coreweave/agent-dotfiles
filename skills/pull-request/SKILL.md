---
name: pull-request
description: Prepare a branch, commit, and open a draft pull request following Ted's git conventions. Use when asked to open a PR, create a pull request, or push changes for review.
---

# Pull request

Follows the git and voice rules in ~/.pi/agent/AGENTS.md. Where this
skill and a repository's own AGENTS.md disagree, the repository wins.

## Authorization

Pushing and opening a PR are gated actions.

- "open a PR" / "push this" authorizes exactly that push and that PR,
  once. It is not standing permission for later pushes.
- "draft the PR text" / "write the description" authorizes no push and
  no PR. Return the text and stop.
- Never open a PR against a repository you were not asked to touch, and
  never merge.

## Process

### 1. Establish the ground truth

```bash
git rev-parse --is-inside-work-tree     # works in linked worktrees
git remote -v                           # confirm the intended remote
git status --short                      # see everything uncommitted
```

Resolve the base branch from the remote rather than guessing:

```bash
base=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
# fallback if gh is unavailable:
# base=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's|^origin/||')
```

### 2. Branch

Naming: `tedski/{fix,feat,chore}/<short-name>`. Pick the type from the
change, keep the name short and specific.

```bash
git switch -c tedski/fix/codeowners-precedence
```

If already on a suitable branch, stay on it. Never create a branch off
unrelated in-progress work without saying so.

### 3. Stage deliberately

Stage the paths that belong to this change. Never `git add -A`: an
unrelated file in the diff is a review finding, and the tree may hold
work that is not yours to commit.

```bash
git add path/to/changed pathnumber/two
git diff --staged        # read this before committing
git status --short       # confirm what is deliberately left behind
```

If unrelated changes exist, leave them and say so in your report.

### 4. Commit

Conventional prefix, short subject, body explains the WHY. The diff
speaks to the what. No "Generated with" footers, no tool attribution,
no emoji.

```bash
git commit -m "fix(scope): short imperative subject" -m "Why this change
exists: the constraint, defect, or decision that forced it. Keep it
readable in git log."
```

### 5. Push and open a draft PR

Only with authorization from step 0.

```bash
git push -u origin HEAD
gh pr create --draft --base "$base" --title "..." --body "..."
```

Draft is the default. Mark ready only when asked.

PR body: intent-level, copy/pasteable, not a code walkthrough.

```markdown
## What

One or two sentences on the change at intent level.

## Why

The motivation. Link the issue, ticket, or failure that prompted it.

## Testing

What you actually ran, and the result. Say what you did not verify.
```

No checkbox scaffolding you did not complete. No screenshots section
when there are no screenshots.

### 6. Report back

Give the PR URL, the branch, what was staged, and anything left
uncommitted on purpose.

## Failure modes

- Push rejected or auth fails: stop and report. Never work around
  permissions or rewrite shared history to force it through.
- PR already exists for the branch: report the existing URL instead of
  opening a second one.
- Base branch resolution fails: ask rather than defaulting to `main`.
