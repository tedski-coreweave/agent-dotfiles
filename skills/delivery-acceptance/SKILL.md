---
name: delivery-acceptance
description: Establish and report the delivery state of a change. Use when wrapping up implementation, handing off work, updating a worklog, declaring a task done, or when merged, deployed, validated, live, or accepted could be confused. Produces an evidence-backed report that separates implementation, integration, application, verification, and consumer acceptance.
---

# Delivery acceptance

A change can be merged, applied, and tested without proving the thing it
was meant to change. Do not collapse those facts into done. Delivery is a
state report. Acceptance is the observation that the intended consumer
received the intended result.

## State model

Report only the states that apply to the work. Each has its own evidence.

- **Implementation**: the intended artifact exists in the working tree or
  committed history.
- **Integration**: the intended shared branch or configuration source
  contains the artifact. A merged pull request is integration.
- **Application**: a target system accepted the change. Terraform applied,
  a service deployed, or an automation enabled are application.
- **Verification**: a bounded check supports a stated property of the
  artifact. Tests, plans, type checks, and configuration-equivalence checks
  are verification.
- **Acceptance**: the intended consumer observed the intended result. The
  consumer may be a user, a production workflow, a downstream service, or a
  human reviewer of the finished artifact.

Use one of these values for every reported state:

- **complete**: cite the evidence.
- **pending**: name the missing evidence and the next signal that can supply
  it.
- **not attempted**: state why it was not run.
- **not applicable**: explain why the state does not exist for this work.
- **unknown**: state the discriminating check or observation.

The states are independent. A passing test is verification. It becomes
acceptance only when it is the agreed consumer of the change.

## Process

1. State the intent and acceptance condition before writing the report. The
   condition names the observable result, not an implementation detail.
2. List the states that apply, then attach direct evidence to each completed
   state. Keep exact commands, URLs, commit IDs, and run IDs in the task's
   existing system of record when they matter.
3. Name every pending or unknown state. Do not turn a lack of errors, elapsed
   time, or an enabled automation into acceptance.
4. For pending acceptance, name the next natural signal when one exists. Do
   not create production traffic, retries, or a synthetic success merely to
   make the report look complete. Ask before a new validation action with
   material blast radius.
5. Put the report in the narrowest existing durable home that needs it. Do
   not create a second status tracker just to use this skill.

## Report

Use this shape for a handoff, worklog update, completion report, or durable
record. Omit states that do not apply, but never omit a pending acceptance
state by calling the work done.

```text
Intent:               <the outcome the change was meant to produce>
Acceptance condition: <what the intended consumer must observe>

State:
- Implementation: <complete | pending | not attempted | not applicable | unknown>
- Integration:    <state and evidence>
- Application:    <state and evidence>
- Verification:   <state and evidence>
- Acceptance:     <state and evidence, or what remains unproven>

Pending or unknown:
- <missing evidence and why it matters>

Next signal:
- <the observation, owner decision, or authorized check that can close it>

Record: <existing durable home, if one exists>
```

Be precise about the boundary. "Merged and verified; acceptance pending the
next qualifying production event" is a complete and useful report. "Done"
is not.

## Examples

### Production behavior has not occurred yet

```text
Intent:               Route a qualifying failure to the responsible owner.
Acceptance condition: A naturally occurring qualifying failure reaches the owner with the right evidence.

State:
- Implementation: complete, commit <sha>
- Integration:    complete, merged pull request <URL>
- Application:    complete, automation configuration is live
- Verification:   complete, unit tests and configuration check passed
- Acceptance:     pending, no qualifying production failure has occurred

Pending or unknown:
- Live routing has not been observed. A synthetic failure would alter the system under test.

Next signal:
- Observe the next natural qualifying failure and record its route.

Record: CI-failure operating log
```

### A documentation change

```text
Intent:               Make a system constraint discoverable to contributors.
Acceptance condition: A reviewer can find the constraint from the documented entry point.

State:
- Implementation: complete, documentation and index updated
- Integration:    complete, merged pull request <URL>
- Verification:   complete, link check passed
- Acceptance:     complete, reviewer followed the documented path to the constraint

Pending or unknown:
- none

Next signal:
- none

Record: repository ADR index
```
