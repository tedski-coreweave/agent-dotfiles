---
name: retro
description: "Retrospective on a coding session that proposes improvements to the agent environment. Use when asked for a retro, 'what should we encode from this', or after a session with repeated corrections, wasted searching, or expensive tool calls."
refs:
  - https://github.com/mattpocock/skills/tree/main/skills/in-progress/retro
---

# Retro

The user asked for a retrospective: audit a session and propose
improvements to the agent's environment so future runs go better. This
is the rule of two, mechanized: find what the session kept paying for,
and propose where to encode the fix.

## Steps

1. Load the writing-for-agents skill; proposals follow its standards.
2. Read the primary sources for the session the user specifies
   (default: the current one). Pi session logs live under
   `~/.pi/agent/sessions/<cwd-encoded-dir>/*.jsonl`; subagent
   transcripts sit in `subagent-artifacts/` beside them.
3. Hunt candidates in these categories:
   - **Navigation**: did the agent burn time finding files or facts?
     Would a pointer in a steering file have cut the search?
   - **Automated checks**: did a mistake ship that a lint, test, hook,
     or `--check` would have caught? Propose the check, not a sentence.
   - **Review rules**: did the reviewer miss something a new rule would
     catch? Should an existing rule be sharpened or deleted?
   - **Steering files**: is always-loaded material (userspace or repo
     AGENTS.md) carrying lines that belong further down the ladder, in
     a skill, doc, or check?
   - **Tool economy**: expensive or token-inefficient tool calls that a
     tighter tool, flag, or subagent dispatch would streamline.
   - **No-ops**: instructions in steering files that don't change
     behavior against the model's defaults. Delete candidates.
   - **Information access**: information the agent needed and couldn't
     reach (logs not teed, service not queryable, missing read access).
4. Present candidates ranked by severity. Each names: the session
   evidence, the proposed encoding, and the tier it belongs in.
   Propose only; edits happen after approval, per the gates.

## Where encodings live (this machine)

- `~/src/agent-dotfiles/userspace/AGENTS.md`: the always-loaded
  execution contract. The most expensive real estate; invariants and
  pointers only.
- `~/src/agent-dotfiles/skills/`: procedures and reference, loaded on
  demand. Descriptions are routing surfaces.
- Mechanical checks: `verify.sh`, pre-commit hooks, `install.sh
  --check`. Prefer these over prose: prose drifts, checks fail loudly.
- `~/obsidian/06_Metadata/Glossary.md`: people, channels, tool quirks.
- Repo tier: the working repo's own AGENTS.md and skills, when the
  lesson is team-shaped rather than personal.

## Implementation vs review

All work passes through two stages with opposite context pressure. The
implementation agent explores, writes, and debugs under the most
pressure; the reviewer receives a diff and carries the least. So
standards enforcement belongs to the reviewer, not the implementer:
encode standards where review loads them, and spend the implementer's
context on the work itself.
