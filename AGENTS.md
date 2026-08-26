# Runbook for agents working in agent-dotfiles

This repo IS the live configuration. Most tracked files are symlink
targets for `~/.pi/agent`, `~/.agents/skills`, `~/.oh-my-zsh/custom`, and
`~/.config/git/ignore.d`. An edit here changes the running system
immediately.
Treat every change as high blast radius, especially `userspace/AGENTS.md`
(loaded by every agent session on this machine) and `skills/` (discovered
globally).

## Rules

- Symlink individual files, never directories, into `~/.pi/agent`.
  Runtime secrets (auth.json, models-store.json, mcp-oauth/, sessions/)
  live beside the targets and must stay untracked real files.
  `~/.agents/skills` is the only permitted directory symlink.
- Never commit anything on the `.gitignore` deny-list. If a diff shows a
  token, key, or transcript, stop and tell Ted.
- Adding a *deployed* file: place it in the repo, add a `source:target`
  entry to `LINKS` in `install.sh`, run `./install.sh`, commit both
  together.
- Repo support files (tests, fixtures, CI config, docs) are not deployed
  and get no `LINKS` entry. `./install.sh --check` ignores them.
  Example: `pi/agent/extensions/codeowners/resolve.test.ts` lives beside
  the deployed extension but only the extension is symlinked.
- Removing a file: remove the LINKS entry, delete the symlink at the
  target, restore or delete the target as appropriate, then delete from
  the repo. Same commit.
- `~/.config/git/ignore` is generated from `~/.config/git/ignore.d/*`
  fragments. Global ignore patterns go in `shell/gitignore.d/50-agents`,
  never in the generated file and never via `core.excludesFile` (which
  would shadow the generated default).
- Run `./install.sh --check` before and after your change. It must exit 0
  when you finish (or the remaining findings must be the point of the PR).
- Verify before committing: `./verify.sh` (shell syntax, tracked JSON,
  codeowners tests, install check). Run the codeowners tests alone with
  `./scripts/test-codeowners.sh` (version-aware; direct `node --test`
  fails on pre-23 Node).
- Mechanical runtime churn (settings.json lastChangelogVersion) commits
  as `chore: sync runtime drift`.
- Local commits fine. Push requires Ted's explicit approval. Always.
- Skills promoted from the vault (~/obsidian) are MOVED, never copied:
  pi keeps the first skill found on a name collision, so a leftover vault
  copy shadows or drifts. Delete the vault original in the same change.

## Where things are decided

The design rationale (modes contract, plan-artifact conventions, tier
rules for config/skills/glossary placement) came from the 2026-08-25
housekeeping session. Governing rule: artifacts live at the narrowest
scope that outlives their use. When unsure where something belongs:
team-useful -> the relevant work repo; personal cross-repo ->  here;
vault ritual or work knowledge -> ~/obsidian.
