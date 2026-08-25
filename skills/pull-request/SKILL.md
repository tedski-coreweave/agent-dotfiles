---
name: pull-request
description: Create a new feature branch, commit changes, push to GitHub, and open a pull request — all in one command. Use when the user asks to open a PR, create a pull request, or push changes for review.
---

# Pull Request Command

Creates a new feature branch, commits changes, pushes to GitHub, and opens a
pull request - all in one command. Perfect for contributing features or fixes.

## Task

Automate the entire pull request workflow: create branch, stage changes, commit
with descriptive message, push to GitHub, and open PR with proper description.

## Process

### 1. **Check Prerequisites**

- Ensure git repository exists
- Check for uncommitted changes to include
- Verify GitHub CLI (`gh`) is available
- Get current branch as base branch
- If already on feature branch, ask: "Create PR from current branch?"

### 2. **Create Feature Branch**

```bash
# Generate branch name from PR title or use provided name
# Sanitize branch name: lowercase, replace spaces with hyphens, remove special chars
branch_name=$(echo "$branch_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g')

# Check if branch already exists
if git show-ref --verify --quiet refs/heads/$branch_name; then
  echo "Branch $branch_name already exists, using alternative name"
  branch_name="${branch_name}-$(date +%s)"
fi

# Format: feature/short-description or fix/issue-name
git checkout -b $branch_name
```

### 3. **Stage and Review Changes**

- Show `git status` to user
- Show `git diff --staged` for review
- If no staged changes, stage all changes: `git add -A`
- Confirm changes with user before proceeding

### 4. **Commit Changes**

- Analyze changes to create meaningful commit message
- Use conventional commits format (feat:, fix:, docs:, etc.)
- Include detailed commit body if changes are complex

```bash
git commit -m "feat: add new feature

- Detail 1
- Detail 2

🤖 Generated with Claude Code"
```

### 5. **Push to GitHub**

```bash
# Push with upstream tracking
git push -u origin feature/[branch-name]
```

### 6. **Create Pull Request**

Use `gh pr create` with:

- Descriptive title
- Detailed body with:
  - Summary of changes
  - Testing checklist
  - Related issues (if any)
- Set base branch (usually main/master)

```bash
gh pr create \
  --title "Feature: Add awesome new capability" \
  --body "$(cat <<'EOF'
## Summary
Brief description of what this PR does

## Changes
- Added feature X
- Fixed bug Y
- Improved performance of Z

## Testing
- [ ] Tested locally
- [ ] All tests pass
- [ ] Documentation updated

## Screenshots
(if applicable)

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)" \
  --base main
```

### 7. **Provide Next Steps**

- Show PR URL
- Remind about review process
- Suggest next actions (request review, add labels, etc.)

## Arguments

- **Optional**: Branch name (auto-generated from changes if not provided)
- **Optional**: PR title (analyzed from changes if not provided)
- **Optional**: Target branch (defaults to main/master)

## Example Usage

```bash
# Auto-generate branch and PR from changes
/pull-request

# Specify branch name
/pull-request feature/add-auth

# Full specification
/pull-request fix/bug-123 "Fix: Resolve authentication timeout issue" develop
```

## Output Example

```
📝 Analyzing changes...
🌿 Creating branch: feature/add-download-command
✅ Committed: feat: add download-attachment command
📤 Pushed to origin
🔗 Pull Request created: https://github.com/user/repo/pull/42

Next steps:
- Request review from team members
- Add relevant labels
- Link related issues
```

## Branch Naming Conventions

- **Features**: `feature/description`
- **Fixes**: `fix/issue-or-description`
- **Documentation**: `docs/what-updated`
- **Refactoring**: `refactor/what-changed`
- **Performance**: `perf/optimization`
- **Tests**: `test/what-tested`

## Commit Message Format

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Formatting, missing semicolons, etc.
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Performance improvement
- `test:` Adding missing tests
- `chore:` Changes to build process or auxiliary tools

## Safety Features

- Confirm before pushing if changes are large
- Show diff before committing
- Verify PR description before creating
- Check if PR already exists for branch
- Handle merge conflicts gracefully

## Error Handling

- If no changes: "No changes to create PR"
- If already on feature branch: Ask if should create PR from current branch
- If PR exists: Show existing PR URL
- If push fails: Check permissions and remote settings
