# agent-dotfiles

Versioned agent-harness configuration for Ted Strzalkowski. Captures the
pi harness today. Other harnesses (claude, codex, devin) get their own
top-level dir when they come in scope; the layout is per-harness on
purpose. Private repo; contains work context, no secrets.

The live system uses these files THROUGH symlinks. Edit here (or edit the
live file; same inode), review the diff here, commit with intent.

## Layout

| Path | Deploys to |
|---|---|
| `userspace/AGENTS.md` | `~/.pi/agent/AGENTS.md` (global agent instructions) |
| `pi/agent/{settings,models,mcp}.json` | `~/.pi/agent/` |
| `pi/agent/npm/package{,-lock}.json` | `~/.pi/agent/npm/` |
| `pi/agent/extensions/codeowners/*` | `~/.pi/agent/extensions/codeowners/` |
| `pi/refresh-netskope-ca.sh` | `~/.pi/` |
| `skills/` | `~/.agents/skills` (directory symlink) |
| `zsh/agents.zsh` | `~/.oh-my-zsh/custom/agents.zsh` |
| `shell/gitignore_global` | `~/.gitignore` |

Files are linked individually, never directories, because `~/.pi/agent`
also holds runtime secrets (auth.json, models-store.json, mcp-oauth/,
sessions/) that must stay untracked real files. `~/.agents/skills` is the
one directory symlink; nothing else writes there.

## Bootstrap (new machine)

1. Install prerequisites: git, node/npm, oh-my-zsh, 1Password CLI (`op`),
   pi (`brew install pi-coding-agent`), and `pre-commit` + `gitleaks`
   (brew) for the secrets hook.
2. Authenticate to GitHub (`gh auth login` or an SSH key), then
   `git clone git@github.com:tedski-coreweave/agent-dotfiles.git ~/src/agent-dotfiles`
3. `cd ~/src/agent-dotfiles && ./install.sh` (use `--force` if real files
   exist at the targets; originals are kept as `<name>.pre-dotfiles`)
4. Say yes to the post-steps, in the order offered: Netskope CA refresh
   first (skip on machines without Netskope; the script exits nonzero
   when no CA is found), then npm install (pi extension packages).
5. `git config --global core.excludesFile ~/.gitignore` (without this,
   git ignores the deployed global gitignore; git's default location is
   ~/.config/git/ignore, not ~/.gitignore) and
   `git config --global init.defaultBranch main` (or new repos default
   to master)
6. `pre-commit install` in this repo (enables the gitleaks hook).
7. Manual auth, in any order:
   - `op signin` (models.json resolves API keys via `!op read` refs)
   - Launch `pi`; provider login creates `~/.pi/agent/auth.json`
   - In pi, `/mcp-auth <server>` for: notion, slack, atlassian,
     glean_default, sourcegraph (GitHub/Datadog have no MCP on purpose;
     use gh and pup)
   - Trust your working dirs when pi asks (or copy
     `pi/agent/trust.json.example` to `~/.pi/agent/trust.json` with your
     username substituted; the real file stays untracked)

## Updating

- Repo -> machine: `git pull`. Rerun `./install.sh` only when files were
  added to the allowlist.
- Machine -> repo: runtime writes (pi bumping `lastChangelogVersion`,
  etc.) flow through the symlinks and show up as `git diff` here. Review,
  commit with intent (`chore: sync runtime drift` for mechanical churn),
  push only with Ted's approval.
- Drift check: `./install.sh --check` (also run during weekly synthesis).

## Adding a file

1. Put it in the repo under the harness dir it belongs to.
2. Add a `source:target` entry to `LINKS` in `install.sh`.
3. `./install.sh` (add `--force` if the target already exists).
4. Commit. The project AGENTS.md has the full rules.

## Secrets policy

Never commit: auth.json, models-store.json, mcp-oauth/, mcp-cache.json,
sessions/, missions/, run-history.jsonl, *.pem, trust.json. The
`.gitignore` deny-list backstops this and the gitleaks pre-commit hook
enforces it. API keys live in 1Password and are referenced with
`!op read` indirection; that pattern is why models.json is committable.
