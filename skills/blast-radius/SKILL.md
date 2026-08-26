---
name: blast-radius
description: "Find what a change could break somewhere else before it ships, beyond the diff, and prove the one fact it's safe because of by running real code instead of writing it up. Use for 'blast radius of X', 'what could this break', or reviewing a small diff you don't trust."
refs:
  - https://github.com/cursor/plugins/tree/main/pstack/skills/blast-radius
---

# Blast radius

Find what a change breaks somewhere else, before it ships. Companion to
the `why` skill: `why` tells you why the code is shaped this way; blast
radius tells you what a change to it breaks elsewhere.

Listing the callers is not the job. Anyone can grep those in a second.
The job is the breakage grep won't show you.

## Don't trust your own writeup

A blast-radius writeup that sounds right is worthless. It reads as
convincing whether or not it's true, and that is the trap. Don't hand
back the writeup. Find the one or two facts the whole thing depends on
and prove them by running code. Words are where you start, not what you
ship.

### How sure are you

For each fact the change's safety depends on, get it as far down this
list as is cheap, and say where it stopped.

1. You said so. Worthless on its own.
2. You pointed at the line. A real `file:line`, or the library's own
   source.
3. You showed the bad case can't happen. You walked the failure step by
   step and it doesn't reach.
4. You ran it. A script or test that calls the real code and fails loud
   if you're wrong.
5. You reproduced it in the running app.

Any safety fact you can't get to step 4, say so out loud. Don't write
it up as settled. Step 4 is usually one small script that imports the
same library the app ships and calls the exact function you're worried
about.

## Steps

1. Read the change: the diff, the symbols it adds, changes, and
   deletes, and what it now does differently, including the part the
   diff doesn't spell out. Pull the PR and recent commits with
   `git log`/`gh pr view` (or run the `why` skill's code-anchor step).
2. Find the one fact it's safe because of. Most changes that look scary
   are safe because of a single fact, like "this call only drops
   already-dead cache entries and does nothing else". Find that fact.
   If it holds, most of the scary cases die at once. Spend your time
   here, not on a long list of maybes.
3. Look where grep stops. Read the source of the library you call, and
   check its pinned version and any local patch. Work out when things
   run: event ordering, teardown and shutdown paths, framework
   lifecycle, goroutine and signal handling. Follow
   what a symbol search misses: the JSON an API returns, a DB column, a
   wire format, another language reading the same bytes, a feature
   flag, code three hops downstream.
4. Be honest about each risk: a real chance of happening and a real
   cost if it does. Keep the risks you confirmed; list the ones you
   checked and cleared separately. Cite a real `file:line`. A search
   that finds nothing is still an answer. Never make up a caller or an
   API.
5. Prove the one fact. Write a script or test that runs the real code,
   run it, and paste what happened. If you can't prove it cheaply, mark
   it unproven. Don't round up.
   Proof scripts run against local fixtures or sandbox state only;
   never point one at shared, remote, or production state. The function
   you're proving facts about may have side effects, and that's often
   exactly why you're worried about it. In a read-only reviewer
   context, don't run proofs at all: report the fact as unproven and
   hand back the script for the author to run.
6. For a big or wide change, fan out: run the adversarial-review skill
   with reviewers on independent angles and different model families.
   Different reviewers catch different real bugs.

## Wide refactors

A wide mechanical refactor is the exception to fearing breadth:
sequence it expand → migrate in blast-radius-sized batches → contract,
each batch green on its own. The blast radius of each batch is what
this skill assesses; the sequencing is what keeps it small.

## What to hand back

- **What it does.** What changed, including the part that isn't
  obvious.
- **The one fact it's safe because of.** State it, say which ladder
  step you got it to, and show the proof. If you couldn't prove it,
  write unproven.
- **Risks.** Only the real ones. Each names how it breaks, the
  `file:line`, how likely and how bad, and how to check. Paste the
  proof for the ones that matter.
- **Cleared.** What you checked and why it's fine.
- **Before you merge.** The cheapest test or repro that catches the
  real bug, including the script you wrote.

Draft the writeup under the writing-voice rules and cite real code.
