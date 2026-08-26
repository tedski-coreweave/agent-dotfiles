---
name: adversarial-review
description: Run a write-then-adversarial-review loop with subagents on a diff, plan, or document. Use when asked for a second opinion, adversarial review, red team, review fanout, or "have someone tear this apart".
---

# Adversarial review

Codifies the loop: one agent authors, another attacks, the author
pushes back where warranted and incorporates the rest. The value comes
from genuine disagreement; a reviewer that rubber-stamps is waste.

## Procedure

1. Pin ground truth in the reviewer prompt. Exact PR numbers, ticket
   IDs, dates, branch names, file paths. Reviewers hallucinating
   references has burned us before; give them the facts so their
   findings attach to reality.
2. Spawn the reviewer(s) read-only.
   - pi: `reviewer` subagent. For a second perspective, add one on a
     different model family (e.g. a codex-side model) so the blind
     spots don't overlap.
   - Scope each reviewer to the artifact plus just enough context.
     Tell them what kind of findings you want (correctness, scope
     creep, readability, missed failure modes) and what's out of scope.
3. Return findings VERBATIM. No softening, no summarizing away the
   sting, no pre-filtering "unimportant" ones.
4. Author responds finding-by-finding: accept (with the fix) or push
   back (with evidence). "Reviewer said so" is not a reason to change
   correct code; "it's a known idiom" is not a defense without a
   citation.
5. Close with a ledger: accepted findings and their fixes, rejected
   findings and why, anything deferred to a follow-up.

## Rules

- Reviewers never edit. They report; the author changes.
- Reviewer and author must be different contexts. An agent reviewing
  its own fresh output finds what it already believed.
- Prefer reviewers with independent angles (correctness, scope creep,
  failure modes, portability) over duplicate generalists; overlap
  wastes tokens, independence finds bugs.
- Disagreement between reviewers is signal, not noise; surface it
  instead of averaging it away.
- Verbatim means verbatim. If a finding is embarrassing, that's the
  finding working.
