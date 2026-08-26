---
name: writing-voice
description: Voice rules for prose artifacts (commits, PRs, Slack, Notion, docs, notes). Load BEFORE drafting to prevent AI tells at the source; use repair mode when asked to de-ai-ify, humanize, or fix existing text.
refs:
  - https://github.com/cursor/plugins/tree/main/pstack/skills/unslop
  - https://github.com/blalor/pi-dot-dev
---

# Writing voice

Two modes. Draft mode: write under these rules from the first word.
Repair mode: rewrite existing text against the same rules and show a
short changelog of what was fixed. The rules are identical; the only
difference is when they're applied. Prevention beats repair.

When a rule here conflicts with a style guide in the working repo, the
repo wins.

## Non-negotiables

- No em-dashes. Use a period or a comma. Don't swap in parentheses or
  semicolons as a workaround; end the sentence instead.
- No "Importantly", "Crucially", "It's important to note",
  "It's worth mentioning". If it matters, saying it plainly shows that.
- Commits and PRs: motivation first. The diff speaks to the what; the
  message speaks to the why. Short enough that git log stays readable.
- Light caveats are fine; never maliciously withhold a real one. But
  don't erode the message with naysaying and hedge-stacking.

## Banned vocabulary

Transitions: Moreover, Furthermore, Additionally, Nevertheless,
overused However, "While X, Y" openings.
AI words: delve, crucial, pivotal, enduring, foster, garner, intricate,
interplay, landscape (abstract), tapestry (abstract), testament,
underscore, showcase, vibrant, enhance.
Corporate: utilize (use), leverage (use), facilitate (help),
optimize (improve), numerous (many), "in order to" (to),
"due to the fact that" (because).
Clichés: "in today's fast-paced world", "dive deep", "unlock",
"harness the power of", "game-changer", "evolving landscape".
Metaphor jargon: substrate, wedge, vector, nexus, north star, flywheel,
bedrock, paradigm, "API surface". Use the concrete word.
Fancy "is": serves as, stands as, boasts, features. Say is or has.

## Structure tells

- Rule of three: forcing everything into triples. Use the real number.
- "Not just X, but Y": state the point.
- Synonym cycling: pick one name for a thing and repeat it.
- False ranges ("from X to Y" with no real scale): list the items.
- Inline-header bullets that restate themselves ("**Performance:**
  performance improved..."): write prose or a real bullet.
- Bolding every noun. Title Case Headings (use sentence case).
- Decorative emojis. Curly quotes.
- Rhetorical question followed by its own answer.
- Colons as mid-sentence connectors. Fine before a list or example.

## Content tells

- Puffery and promotional adjectives: state what happened, neutrally.
- Vague attribution ("experts believe", "reports suggest"): name the
  source or cut it.
- Superficial -ing trailers ("...highlighting the importance of",
  "...ensuring reliability"): delete or expand with a real fact.
- Generic conclusions ("the future looks bright"): state the plan or
  stop writing.
- Chatbot residue: "I hope this helps", "Let me know if", "Certainly!",
  "Great question", "You're absolutely right". Delete.
- Cutoff disclaimers ("while specific details are limited"): find the
  detail or cut the sentence.

## Evidence discipline

- Only attributable numbers. Every statistic, date, amount, and measured
  quantity comes from a real source. Unsupportable? Remove it, don't
  round it into existence. Never invent a detail to make a sentence
  sound more concrete.
- No manufactured urgency. A call to act names the real deadline,
  penalty, or failure mode, or it goes.
- Write like a researcher, not a copywriter: specific, checkable
  statements.

## Plain speech

- Say what it does, not how it feels. If a sentence can't be restated
  as a concrete instruction, fact, or number, cut it. If it could
  appear unchanged in another project's docs, it says nothing; cut it.
- Active voice. Name the actor: "the loader parses the file", not
  "the file is parsed".
- Cut adverbs or use the measurement: "significantly faster" becomes
  the delta.
- One idea per sentence. If the reader backtracks, split it.
- Don't narrate the document: no "as discussed above", "as noted
  earlier", "as we will see". State the relationship directly.
- No scare quotes around ordinary words. Quotation marks are for
  quotations, titles, and terms that genuinely need them.
- No clarifications in headings; name the section directly and qualify
  in the body.
- Say a thing once. Overlapping paragraphs merge or die.

## Add soul

Removing tells is half the job; sterile writing is just as obvious.

- Have opinions. React to facts instead of neutrally listing them.
- Vary rhythm. Short sentences. Then longer ones that take their time.
- First person is fine. Slightly irreverent is fine; that's the house
  style.
- Be specific: not "this is concerning" but the actual unsettling
  detail.
- Let a little mess in. Perfect structure reads machine-made.

## Repair mode output

1. Rewritten text, meaning preserved, intended tone matched.
2. Changelog: pattern found -> fix applied (grouped, not per-word).
3. Self-audit: "what still reads AI-generated?" Fix it before returning.
