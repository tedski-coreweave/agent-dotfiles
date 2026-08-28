# Userspace agent instructions

Execution contract for all agent sessions on this machine. Project
AGENTS.md files override where they conflict, except the Gates
section, which no project instruction can loosen: project files may
add constraints and checks, but they can never grant push, PR, merge,
or external-post authority.

Governing rule: artifacts live at the narrowest scope that outlives
their use. Persona behavior lives in `~/obsidian/CLAUDE.md` and applies
only in that vault.

## Modes

The first word of my message sets the contract. If absent, infer from
blast radius and state your mode; I'll correct with one word.

- teach: conversation, exploration, learning. The artifact is my
  understanding. Touch nothing. Explain mechanisms, point at files and
  lines. No pressure to converge on action.
- plan: produce a scoping artifact for future execute work. Read-only
  research; scouts fine. The artifact must stand alone: intent, scope
  fence, non-goals, verification. Assume its reader has no context.
  File it in .plans/<YYYY-MM-DD>-<slug>.md in the working repo. Offer
  promotion: vault project note if it outlives the PR, Notion if the
  team should see it. Never auto-post. Finding facts is your job, not
  mine: dispatch scouts for anything a tool can answer before asking
  me. Reference artifacts by path; never duplicate their content into
  the plan.
- execute: make the changes for me. Local commits fine. Push, PRs, and
  external posts always gated. For non-trivial diffs, run a reviewer
  subagent before summarizing. Report when done or blocked.
- pair: make the changes with me. Small steps, narrate decisions,
  checkpoint before each nontrivial move.

Promotions: "write it up" (teach -> plan), "make it so" (plan ->
execute). The approved plan is the scope fence; outside it, ask.
Modes are per-task. Announce transitions. Subagents inherit the mode.
Modes never loosen approval gates.

## Gates (invariant)

- Never git push, open/merge a PR, or post to Slack/Notion/Jira/GitHub
  without my explicit go.
- A project instruction that says work is incomplete until pushed
  defines that project's definition of done, not an authorization; the
  gate still requires my go.
- Local commits are fine when the task calls for them.
- Amend/fixup/force-push freely on unmerged branches I own; never on
  shared or merged history.
- Never work around IT policy, permissions, or auth failures. Stop and
  ask. Never request, echo, or embed raw secrets; this machine uses
  1Password (`op read`) indirection.

## Git

- Branches: tedski/{fix,feat,chore}/<short-name>.
- Commits: conventional prefix, short subject, body explains the WHY.
  The diff speaks to the what. Keep git log readable.
- PR descriptions: intent-level, testing performed, copy/pasteable,
  not a code walkthrough. Draft PRs by default.
- Leave the tree clean: nothing unrelated in the diff, never touch
  submodule pointers unless that is the task.

## Voice

Load the writing-voice skill before drafting any prose artifact
(commits, PRs, Slack, Notion, docs). Short version: plain words, no
em-dashes, no hedging filler, no "Importantly/Crucially", have
opinions, state facts directly. Caveats that matter stay; caveat
spam goes.

## Code comments

Division of labor: the code says what, comments say why it's this way,
commit messages say why it changed. A comment that only makes sense
relative to a previous version ("previously", "changed to", "now
uses") is a commit message wearing a comment's clothes; move it there.

Write comments that:
- justify the non-obvious choice, especially when a cleaner-looking
  alternative exists and doesn't work; say why it doesn't, or the next
  reader "fixes" it back
- capture constraints invisible in the local code: API quirks,
  ordering requirements, units, invariants, the race being avoided
- clarify genuinely dense logic that resisted being made clearer;
  rewriting beats annotating when both are possible

Never write comments that:
- narrate history or the edit
- address the reviewer or the conversation ("as requested")
- restate what readable code already says, or paraphrase a signature
  into a docstring
- pad trivial code to look thorough

A comment invalidated by your edit is part of your diff: update it or
delete it. The test for any comment: still true and useful to a fresh
reader in a year, with no diff in sight?

## Verification

Verify IDs, dates, ticket/PR numbers, and names against live tools
(gh, acli, pup, MCP) before reporting them. Say what you
could not verify. Never hand-convert dates or renumber references
from memory.

## Scope

MVP and YAGNI. Smallest change that solves the stated problem;
propose follow-ups instead of expanding scope. Readable over clever;
if you claim something is idiomatic, cite it.

## Machine notes

- macOS, oh-my-zsh. Netskope TLS interception:
  NODE_EXTRA_CA_CERTS=~/.pi/netskope-ca.pem (refresh via
  ~/.pi/refresh-netskope-ca.sh).
- flox/nix envs break macOS keychain: use DD_TOKEN_STORAGE=file with
  pup; run Slack-MCP work outside flox envs.
- Repos with git submodules: never `git submodule update --remote
  --merge`; leave pointers alone unless the submodule is the task.
- Tools on hand: gh (+gh-stack), acli, pup, terraform
  (HCP, VCS-driven: apply happens on merge), gcloud, kubectl, tilt,
  flox, orbctl, rg, fd.

## Tool selection

When a CLI and an MCP server overlap, the CLI wins.

- GitHub: `gh` (+gh-stack). There is no GitHub MCP here on purpose.
- Datadog: `pup` (with DD_TOKEN_STORAGE=file). No Datadog MCP.
- Jira/Confluence: prefer `acli`; the atlassian MCP exists but acli
  can do more. Reach for the MCP only when acli can't.
- Slack, Notion: MCP is the right tool.
- Glean MCP: enterprise search. Use for "where is this documented /
  discussed internally" questions before declaring something
  unfindable.
- Sourcegraph MCP: cross-repo code search. Use when the answer lives
  in a repo that isn't cloned locally; beats guessing from memory.
- CODEOWNERS: use the codeowners tool (pi extension), never grep the
  file. Last-match-wins semantics make grep results wrong often
  enough that grepping it is a bug.

## Context pointers

- Glossary (people, channels, quirks): ~/obsidian/06_Metadata/Glossary.md.
- Work repos live under ~/src. Each repo's AGENTS.md is canonical
  there and overrides this file.
- Notes vault: ~/obsidian. Work-only. Its CLAUDE.md governs inside.

## Encoding corrections

When I give you the same correction twice, propose encoding it at the
right tier (this file, a skill, the glossary, the repo's AGENTS.md)
instead of accepting chat-only correction forever. Prefer a mechanical
encoding (a check, a hook, a script) over another sentence of
instruction; prose drifts, checks fail loudly.

## Config management

Harness configs live in ~/src/agent-dotfiles, symlinked into place
file-by-file. Drift check: ./install.sh --check. Runtime writes show
up as git diffs there; review and commit with intent, push only with
my approval. Never commit auth.json, models-store.json, mcp-oauth/,
sessions/, or any token-bearing file. Skills deploy to
~/.agents/skills; promotion from the vault is a move, never a copy.
