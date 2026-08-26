---
name: git-worktrees
description: Work with git worktrees for isolated parallel development. Use when starting feature work in isolation, when need separate workspace without branch switching, or when cleaning up worktrees after PR merge.
---

# Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing
work on multiple branches simultaneously without switching. Each worktree is a
separate directory with its own working tree, but they share the same `.git`
history.

## When to Use Worktrees

- **Parallel development**: Work on feature A while feature B builds/tests
- **Code review**: Check out PR branch without disrupting current work
- **Experiments**: Try something risky without affecting main workspace
- **Long-running tasks**: Keep main branch available while feature develops

## Quick Reference

| Action | Command |
|--------|---------|
| List worktrees | `git worktree list` |
| Create worktree | `git worktree add <path> -b <branch>` |
| Create from existing branch | `git worktree add <path> <branch>` |
| Remove worktree | `git worktree remove <path>` |
| Prune stale worktrees | `git worktree prune` |

## Creating Worktrees

### New Feature Branch

Branch naming follows the userspace convention:
`tedski/{fix,feat,chore}/<short-name>`.

```bash
# Create worktree with new branch
git worktree add .worktrees/my-feature -b tedski/feat/my-feature

# Base it on the remote default branch rather than assuming main
base=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's|^origin/||')
git worktree add .worktrees/my-feature -b tedski/feat/my-feature "origin/$base"
```

### From Existing Branch

```bash
# Check out existing remote branch
git worktree add .worktrees/pr-review origin/fix-bug

# Check out existing local branch
git worktree add .worktrees/hotfix tedski/fix/urgent-thing
```

## Directory Structure

```
project/
├── .git/                    # Shared git history
├── .worktrees/              # Convention: keep worktrees here
│   ├── feature-a/           # First worktree
│   └── feature-b/           # Second worktree
└── src/                     # Main worktree files
```

## Setup After Creating Worktree

After creating a worktree, you typically need to:

```bash
cd .worktrees/my-feature
```

Follow the repository's own setup instructions (its README or
AGENTS.md) for dependencies and configuration. A fresh worktree has no
ignored files, so anything gitignored has to come from that documented
setup.

Do not blanket-copy environment files between worktrees. They usually
hold credentials, and copying them scatters secrets into new
directories. If a specific file is required, copy that one file
deliberately, from the main worktree root:

```bash
# From .worktrees/<name>, the main worktree root is two levels up
cp ../../.env.local .env.local
```

## Safety Rules

**NEVER remove a worktree with uncommitted changes without confirmation.**

```bash
# Check for uncommitted changes first
git -C .worktrees/my-feature status --porcelain

# If empty, safe to remove
git worktree remove .worktrees/my-feature

# Delete the branch after merge (-d is safe, fails if not merged)
git branch -d tedski/feat/my-feature
```

### Removal Decision Matrix

| PR merged? | Uncommitted changes? | Action |
|------------|----------------------|--------|
| Yes | No | Safe to remove |
| Yes | Yes | Ask first, uncommitted changes are lost |
| No | No | Removing the worktree is safe, committed branch history survives. Keep the branch; do not delete it |
| No | Yes | Do not remove, active uncommitted work |

Removing a worktree deletes the directory, not the branch. Commits on
that branch remain in the repository, so an unmerged but clean worktree
can be removed and recreated later. Only uncommitted work is at risk.

## Cleaning Up Worktrees

### Manual Cleanup

```bash
# 1. Check if work is merged (if using GitHub)
gh pr list --head tedski/feat/my-feature --state merged

# 2. Check for uncommitted changes
git -C .worktrees/my-feature status --porcelain

# 3. Remove worktree (only if merged or confirmed with user)
git worktree remove .worktrees/my-feature

# 4. Delete branch (-d refuses when unmerged, which is the safety net)
git branch -d tedski/feat/my-feature
```

### Prune Stale Worktrees

If a worktree directory was deleted manually:

```bash
git worktree prune
```

## Common Patterns

### Review a PR

```bash
# Create worktree from PR branch
git fetch origin pull/123/head:pr-123
git worktree add .worktrees/pr-123 pr-123

# Review, test, then clean up
git worktree remove .worktrees/pr-123
git branch -D pr-123
```

### Parallel Feature Development

```bash
# Main work continues in project root
# Start new feature in worktree
git worktree add .worktrees/new-api -b tedski/feat/new-api

# Work on both simultaneously
code .worktrees/new-api  # Opens new VS Code window
```

## Troubleshooting

### "Branch already checked out"

A branch can only be checked out in one worktree at a time:

```bash
# Find where branch is checked out
git worktree list

# Remove that worktree first, or use different branch
```

### "Worktree directory not empty"

```bash
# Force add if directory exists but isn't a worktree
git worktree add --force <path> <branch>
```

### Locked Worktree

If a worktree is locked (prevents accidental removal):

```bash
# Unlock it
git worktree unlock <path>

# Then remove
git worktree remove <path>
```
