# Model selection guide

Maps workloads to models across the three configured providers:
Anthropic, OpenAI Codex, and W&B Inference. These are starting points
from provider descriptions and teammate experience, not benchmarked
equivalences. Update entries as real usage sorts them; an entry nobody
picks in a month is a removal candidate.

Adapted from Brian Lalor's SUITABLE_MODELS.md
(https://github.com/blalor/pi-dot-dev), extended to three providers.
W&B model claims trace to the [W&B Serverless Inference
catalog](https://docs.wandb.ai/inference/models).

## By workload

| Workload | Anthropic | OpenAI Codex | W&B Inference |
| --- | --- | --- | --- |
| Daily driver | claude-sonnet-5, thinking medium | gpt-5.5, gpt-5.6-terra | GLM-5.2 |
| Long-horizon agentic coding (escalation) | claude-opus-5, thinking high/xhigh | gpt-5.6-sol, gpt-5.6-terra | Kimi-K2.7-Code (262K ctx, purpose-built per W&B), MiniMax-M3 (262K ctx, accepts images) |
| Cross-family second opinion (adversarial-review) | sonnet/opus when the author was codex | gpt-5.6-terra when the author was anthropic | Kimi-K2.7-Code or GLM-5.2 as a third leg |
| Very large context analysis | — | — | DeepSeek-V4-Pro (1M-class context per W&B docs) |
| Cheap helper chores (naming, summaries, glue) | claude-haiku-4-5 | gpt-5.4-mini | Qwen3.5-35B-A3B, gpt-oss-120b |

The actual configured default lives in `pi/agent/settings.json` and is
not restated here; restating config in prose is how docs drift into
lying.

## Serving differences that matter

- Our `WandB-Inference` provider (`pi/agent/models.json`) speaks
  OpenAI-compatible completions at `api.inference.wandb.ai` with a 32K
  max output per model and no reasoning-effort control. Long tool-heavy
  runs and deep-thinking workloads behave differently there than on the
  native Anthropic/Codex APIs; prefer the native providers for those
  until measured otherwise.
- Anthropic models take pi thinking levels; W&B-served models do not.
- Context-window and capability claims for W&B models come from the
  catalog, not from our own measurements.

## House rules

- Dogfood note: W&B Inference is the employer's product. Prefer it for
  helper chores and third-leg reviews where it's plausibly sufficient;
  that's usage data the team can act on.
- No model claim in this file gets stated as fact elsewhere without
  checking the linked sources; catalogs drift.
