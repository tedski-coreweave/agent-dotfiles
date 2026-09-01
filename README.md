# agent-dotfiles

Versioned personal agent-harness configuration. Captures the
pi harness today. Other harnesses (claude, codex, devin) get their own
top-level dir when they come in scope; the layout is per-harness on
purpose.

The live system uses these files THROUGH symlinks. Edit here (or edit the
live file; same inode), review the diff here, commit with intent.

## Layout

| Path | Deploys to |
|---|---|
| `userspace/AGENTS.md` | `~/.pi/agent/AGENTS.md` (global agent instructions) |
| `pi/agent/{settings,models,mcp}.json` | `~/.pi/agent/` |
| `pi/agent/npm/package{,-lock}.json` | `~/.pi/agent/npm/` |
| `pi/agent/extensions/codeowners/*` | `~/.pi/agent/extensions/codeowners/` |
| `pi/agent/extensions/attention-notify.ts` | `~/.pi/agent/extensions/` |
| `pi/refresh-netskope-ca.sh` | `~/.pi/` |
| `skills/` | `~/.agents/skills` (directory symlink) |
| `herdr/config.toml` | `~/.config/herdr/config.toml` |
| `zsh/agents.zsh` | `~/.oh-my-zsh/custom/agents.zsh` |
| `shell/gitignore.d/50-agents` | `~/.config/git/ignore.d/` (fragment; see below) |

Files are linked individually, never directories, because `~/.pi/agent`
also holds runtime secrets (auth.json, models-store.json, mcp-oauth/,
sessions/) that must stay untracked real files. `~/.agents/skills` is the
one directory symlink; nothing else writes there.

## Bootstrap (new machine)

1. Install prerequisites: git, node/npm (Node 23+ preferred; older
   versions work via a fallback flag), oh-my-zsh, 1Password CLI (`op`),
   pi (`brew install pi-coding-agent`), optional Herdr (`brew install herdr`),
   and `pre-commit` + `gitleaks` (brew) for the secrets hook.
2. Authenticate to GitHub (`gh auth login` or an SSH key), then
   `git clone git@github.com:tedski-coreweave/agent-dotfiles.git ~/src/agent-dotfiles`
3. `cd ~/src/agent-dotfiles && ./install.sh` (use `--force` if real files
   exist at the targets; originals are kept as `<name>.pre-dotfiles`)
4. Say yes to the post-steps, in the order offered: Netskope CA refresh
   first (skip on machines without Netskope; the script exits nonzero
   when no CA is found), then npm install (pi extension packages).
5. `git config --global init.defaultBranch main` (or new repos default
   to master). Do NOT set `core.excludesFile`; the global gitignore is
   generated at git's default location (see below) and an excludesFile
   setting silently shadows it.
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
  push only with the owner's approval.
- Drift check: `./install.sh --check` (also run during weekly synthesis).

## Global gitignore

`~/.config/git/ignore` (git's default global excludes path) is a
GENERATED file: install.sh concatenates every fragment in
`~/.config/git/ignore.d/` in filename order. This repo contributes the
`50-agents` fragment via symlink; any other dotfiles repo can drop its
own fragment (e.g. `10-user`) and regenerate without coordination.
Numbered prefixes control order, which matters for negation patterns.
Edit fragments, never the generated file; `--check` flags a stale or
hand-edited result, and direct edits are overwritten on the next
install.

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
