---
name: agent-environment-audit
description: Audit recent agent sessions and related work for repeated manual effort that should become a check, extension, skill, or instruction. Use when asked to audit sessions, find repeated agent work, decide what to encode, or review recurring workflow pain. Produces a ranked, evidence-backed encoding proposal without making changes.
---

# Agent environment audit

Mine a bounded set of sessions and their related work for a repeated cost that
has earned a durable fix. This is not a retrospective of one run. Use
`retro` for that. This is not a mandate to add a skill. The right answer is
often a check, a narrower existing instruction, or no change.

## Gather evidence

1. Load `writing-for-agents` before proposing an encoding and
   `writing-voice` before drafting the report.
2. Declare the audit window and sources. Default to recent Pi sessions for the
   current repository and the directly related local work: commits, plans,
   verification output, and configuration changes. Do not broaden to other
   repositories or the vault without a reason tied to the request.
3. Read the selected session JSONL files under
   `~/.pi/agent/sessions/<cwd-encoded-dir>/` and relevant adjacent subagent
   artifacts. Correlate claims with durable artifacts rather than treating a
   transcript as proof by itself.
4. Treat session records as sensitive evidence. Keep raw transcript content,
   credentials, tokens, private messages, and auth material out of the report.
   If redaction would hide the fact needed to support a candidate, name the
   evidence source and the fact it establishes without reproducing the data.
5. Look for candidates in these categories:
   - navigation
   - automated checks
   - review rules
   - steering files
   - tool economy
   - no-ops
   - information access

## Establish recurrence

A candidate needs one of these evidence bars:

- two independent occurrences of the same concrete cost or failure; or
- one occurrence with a demonstrated mechanical failure that a check can
  reproduce.

Similar requests, generic friction, and a one-off agent mistake do not meet
that bar. Keep them as observations that name the next evidence needed. Check
existing skills, instructions, checks, and extensions before proposing a new
artifact. An already encoded behavior may need sharpening, relocation, or
removal instead.

## Choose the narrowest encoding

Apply these choices in order:

1. **Check, hook, script, or extension** for a deterministic condition that
   can be observed and enforced mechanically.
2. **On-demand skill** for a repeated procedure or reference that needs more
   than a short pointer.
3. **Repository AGENTS.md** for a repository-specific rule that must apply to
   every task in that repository.
4. **`userspace/AGENTS.md`** for a cross-repository invariant or a pointer to
   an on-demand procedure. A hard authorization restriction belongs in the
   global Gates contract, never an optional skill.
5. **Glossary or project record** for factual context rather than behavioral
   instruction.

Respect ownership boundaries. Global skills own portable process and shared
vocabulary. Repository and vault adapters own their local conventions. Do not
fork an existing taxonomy or create a second source of truth.

## Report

Rank only candidates that meet the evidence bar. Put observations that need
another occurrence in a separate section.

```text
Audit window: <bounded dates or session identifiers>
Sources: <sessions and durable artifacts inspected>

Candidate: <short name>
Severity: <critical | high | medium | low>
Repeated cost: <what recurred and who paid it>
Recurrence evidence, choose one:
- <two independent occurrences, with source references>; or
- <one occurrence plus reproducible mechanical failure, with source references>
Existing coverage: <what already exists, or none>
Recommendation: <check | extension | skill | repo AGENTS.md | userspace AGENTS.md | record>
Placement: <exact proposed path or owning system>
Why this tier: <why cheaper or existing options do not fit>
Expected benefit: <concrete expected saving or risk reduction>
Verification: <a falsifiable check or dry-run>

Needs more evidence:
- <observation, why it falls short, and the next discriminating evidence>

No change:
- <already-encoded behavior or one-off that should stay unencoded>
```

Propose only. Do not edit skills, instructions, extensions, checks, work
records, or external systems during the audit. A later approved task owns each
accepted candidate.
