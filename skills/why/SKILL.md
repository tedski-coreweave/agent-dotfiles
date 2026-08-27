---
name: why
description: "Dig up why code is the way it is: design rationale, rejected alternatives, the incident behind a defensive guard. Use for 'why does X work this way', 'why did we pick Y', regressions, postmortems, or data-backed thresholds. Sweeps git/PR history, tickets, docs, chat, and observability, then returns a cited, confidence-calibrated read."
---

# Why

Investigate the motivation and intent behind code. What forces shaped
the design, what alternatives were rejected, what incident is the null
check remembering. The code says what it does; comments say why it's
this way; this skill is for when neither answers the question and the
truth lives in the historical record.

## Posture

Work like a detective on a cold case built from fragmentary records.
Tickets go stale, chat threads die, commit messages lie, authors leave.

- Evidence before narrative. Collect first, then see what story the
  pieces support. Never pick a story and recruit evidence for it.
- Cite everything: commit hash, PR number, ticket ID, doc URL, chat
  permalink. Uncitable claims are inference and get labeled as such.
- Prefer "appears to" over "because". Confident language is reserved
  for direct, explicit evidence.
- Surface contradictions; show both sources. Multiple live hypotheses
  are a valid result.
- Null results are first-class evidence. "This was never ticketed" is
  a finding about how the decision was made. Report searched-and-empty
  alongside found.
- Don't infer intent from code shape. Code that makes sense today may
  have been written for reasons that no longer apply, or none.

## Step 1: parse the question

Identify the target (code, pattern, decision) and the question type:
design rationale, tradeoff/alternatives, motivating edge cases,
external forcing function, dead-code suspicion, or broad history. If
the target is vague, state your interpretation in one line and proceed.

## Step 2: build the code anchor

Cheap, and every later search needs it:

```bash
git blame -L <start>,<end> <file>          # last-touch commits
git log --follow --oneline -20 -- <file>   # history through renames
git log -1 --format=%B <commit>            # PR number from message
gh pr view <n> --json title,body,author,comments,reviews,closingIssuesReferences
# Inline review-thread comments; gh pr view does not return these:
gh api "repos/<owner>/<repo>/pulls/<n>/comments"
```

Capture file paths, symbols, commit hashes, PR numbers, and linked
ticket IDs as seed context.

## Step 3: sweep the evidence categories

The answer's location is unpredictable, so default to coverage across
every category available on this machine. CLI wins over MCP, per the
userspace tool rules.

| Category | Tool here |
|---|---|
| Source control (always) | git + `gh`: PR bodies, review threads, test names |
| Tickets | `acli` first; atlassian MCP when acli can't |
| Long-form docs | Notion MCP; Glean MCP for cross-source search |
| Team chat | Slack MCP; Glean when the channel is unknown |
| Observability / incidents | `pup` (Datadog): monitors, dashboards, incident notes |
| Code in other repos | Sourcegraph MCP: when the trail crosses into uncloned repos |
| Product analytics | none configured; record as a gap |

If the target code looks defensive (null checks, retries, timeouts,
rate limits, feature flags), weight the incident/observability sweep
up; guards usually remember an outage.

For a broad question, fan the categories out to parallel read-only
subagents, one per category, each seeded with the code anchor and the
original question. For a narrow one, sweep sequentially and stop when
the evidence converges. Either way, produce a coverage map: searched
and found, searched and empty, skipped and why.

## Step 4: synthesize

A cited read on the decision, not a satisfying story:

- Findings with citations, confidence language matched to evidence
  strength.
- Contradictions and competing hypotheses, with the evidence for each.
- The coverage map, gaps named. "We couldn't find out why" is a valid,
  useful answer; a confident guess is not.
