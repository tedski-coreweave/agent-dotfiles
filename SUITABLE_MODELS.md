# Model selection guide

Maps workloads to every model currently selectable through Pi. These are
starting points from provider metadata and teammate experience, not benchmarked
equivalences. `routed` means the model has an intentional workload. `alias`
means a dated or equivalent selector follows another entry's route. `parked`
means available but not selected automatically until usage supplies evidence.

Adapted from Brian Lalor's guide. See [CREDITS.md](CREDITS.md).
W&B claims trace to the [W&B Serverless Inference
catalog](https://docs.wandb.ai/inference/models) and the checked-in provider
metadata in `pi/agent/models.json`.

## Recommended routing

| Workload | Anthropic | OpenAI Codex | Devin | W&B Inference |
| --- | --- | --- | --- | --- |
| Daily driver | `anthropic/claude-sonnet-5`, medium | `openai-codex/gpt-5.6-terra`, medium | parked | `WandB-Inference/zai-org/GLM-5.2` |
| Long-horizon coding escalation | `anthropic/claude-opus-5`, high/xhigh | `openai-codex/gpt-6-sol`, high | `devin/swe-1-7` | `WandB-Inference/moonshotai/Kimi-K2.7-Code`, `WandB-Inference/MiniMaxAI/MiniMax-M3` |
| Model-paired native review | `anthropic/claude-haiku-4-5`, `anthropic/claude-sonnet-5`, `anthropic/claude-opus-5` | `openai-codex/gpt-6-luna`, `openai-codex/gpt-5.6-terra`, `openai-codex/gpt-6-sol`, `openai-codex/gpt-6-astra` | parked | `WandB-Inference/deepseek-ai/DeepSeek-V4-Pro` |
| Explicit third-leg review | — | — | — | `WandB-Inference/moonshotai/Kimi-K2.7-Code` |
| Very large context analysis | `anthropic/claude-fable-5` | — | — | `WandB-Inference/deepseek-ai/DeepSeek-V4-Pro` |
| Cheap helper chores | `anthropic/claude-haiku-4-5` | `openai-codex/gpt-6-luna` | parked | `WandB-Inference/Qwen/Qwen3.5-35B-A3B`, `WandB-Inference/openai/gpt-oss-120b` |

The actual parent default lives in `pi/agent/settings.json`. This guide does
not duplicate it.

## Native reviewer routing

Before launching the builtin `reviewer`, find the exact current parent selector
in this table and pass its reviewer selector as the per-run `model`. The pair is
a cross-family capability match, not a claim of benchmark equivalence. Parked
or unevaluated parents get a conservative strong reviewer rather than an
invented peer ranking. Explicit review fanout may add the third leg above.

<!-- reviewer-routing:start -->
| Parent selector | Reviewer selector |
| --- | --- |
| `anthropic/claude-fable-5` | `openai-codex/gpt-5.6-sol` |
| `anthropic/claude-fable-5-1` | `openai-codex/gpt-5.6-sol` |
| `anthropic/claude-haiku-4-5` | `openai-codex/gpt-6-luna` |
| `anthropic/claude-haiku-4-5-20251001` | `openai-codex/gpt-6-luna` |
| `anthropic/claude-opus-4-5` | `openai-codex/gpt-5.6-sol` |
| `anthropic/claude-opus-4-5-20251101` | `openai-codex/gpt-5.6-sol` |
| `anthropic/claude-opus-4-6` | `openai-codex/gpt-5.6-sol` |
| `anthropic/claude-opus-4-7` | `openai-codex/gpt-5.6-sol` |
| `anthropic/claude-opus-4-8` | `openai-codex/gpt-5.6-sol` |
| `anthropic/claude-opus-5` | `openai-codex/gpt-6-sol` |
| `anthropic/claude-opus-5-5` | `openai-codex/gpt-6-sol` |
| `anthropic/claude-sonnet-4-5` | `openai-codex/gpt-5.6-terra` |
| `anthropic/claude-sonnet-4-5-20250929` | `openai-codex/gpt-5.6-terra` |
| `anthropic/claude-sonnet-4-6` | `openai-codex/gpt-5.6-terra` |
| `anthropic/claude-sonnet-5` | `openai-codex/gpt-5.6-terra` |
| `devin/swe-1-6` | `anthropic/claude-opus-5` |
| `devin/swe-1-7` | `anthropic/claude-opus-5` |
| `openai-codex/gpt-5.3-codex-spark` | `anthropic/claude-haiku-4-5` |
| `openai-codex/gpt-5.5` | `anthropic/claude-sonnet-5` |
| `openai-codex/gpt-5.6-luna` | `anthropic/claude-sonnet-5` |
| `openai-codex/gpt-5.6-sol` | `anthropic/claude-opus-5` |
| `openai-codex/gpt-5.6-terra` | `anthropic/claude-sonnet-5` |
| `openai-codex/gpt-6-astra` | `anthropic/claude-opus-5` |
| `openai-codex/gpt-6-luna` | `anthropic/claude-sonnet-5` |
| `openai-codex/gpt-6-sol` | `anthropic/claude-opus-5` |
| `WandB-Inference/deepseek-ai/DeepSeek-V3.1` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/deepseek-ai/DeepSeek-V4-Flash` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/deepseek-ai/DeepSeek-V4-Flash-0731` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/deepseek-ai/DeepSeek-V4-Pro` | `anthropic/claude-opus-5` |
| `WandB-Inference/deepseek-ai/DeepSeek-V4-Pro-0813` | `anthropic/claude-opus-5` |
| `WandB-Inference/deepseek-ai/DeepSeek-V4.1-Flash` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/google/gemma-4-26B-A4B-it` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/google/gemma-4-31B-it` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/ibm-granite/granite-4.1-8b` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/ibm-granite/granite-4.2-8b` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/JetBrains/Mellum2-12B-A2.5B-Instruct` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/meta-llama/Llama-3.1-70B-Instruct` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/meta-llama/Llama-3.1-8B-Instruct` | `anthropic/claude-haiku-4-5` |
| `WandB-Inference/meta-llama/Llama-3.3-70B-Instruct` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/MiniMaxAI/MiniMax-M3` | `anthropic/claude-opus-5` |
| `WandB-Inference/moonshotai/Kimi-K2.6` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/moonshotai/Kimi-K2.7-Code` | `anthropic/claude-opus-5` |
| `WandB-Inference/nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B` | `anthropic/claude-opus-5` |
| `WandB-Inference/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/openai/gpt-oss-120b` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/openai/gpt-oss-20b` | `anthropic/claude-haiku-4-5` |
| `WandB-Inference/OpenPipe/Qwen3-14B-Instruct` | `anthropic/claude-haiku-4-5` |
| `WandB-Inference/Qwen/Qwen3-30B-A3B-Instruct-2507` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/Qwen/Qwen3.5-35B-A3B` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/Qwen/Qwen3.6-27B` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/Qwen/Qwen3.6-35B-A3B` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/Qwen/Qwen3.8-27B` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/zai-org/GLM-5.2` | `anthropic/claude-sonnet-5` |
| `WandB-Inference/zai-org/GLM-5.3-Flash` | `anthropic/claude-sonnet-5` |
<!-- reviewer-routing:end -->

The table is policy carried out by the parent agent. `modelScope` rejects
reviewer targets outside its finite approved set, but it cannot enforce which
approved pair belongs to a parent. Omitting the per-run model inherits the
parent. If that parent is also an approved review target, including the default
`openai-codex/gpt-5.6-terra`, the mistake does not fail. The override is
mandatory. Trusted project settings can replace the user scope.

## Catalog coverage

Every selector emitted by `pi --list-models` appears exactly once in this
block. Routes refer to the workload table above. Aliases name their canonical
entry. Parked models remain selectable but are not automatic choices.

<!-- model-catalog:start -->
| Selector | Status | Home |
| --- | --- | --- |
| `anthropic/claude-fable-5` | routed | very large context analysis |
| `anthropic/claude-fable-5-1` | alias | `anthropic/claude-fable-5` |
| `anthropic/claude-haiku-4-5` | routed | cheap helper chores; model-paired review |
| `anthropic/claude-haiku-4-5-20251001` | alias | `anthropic/claude-haiku-4-5` |
| `anthropic/claude-opus-4-5` | parked | available, not yet routed |
| `anthropic/claude-opus-4-5-20251101` | alias | `anthropic/claude-opus-4-5` |
| `anthropic/claude-opus-4-6` | parked | available, not yet routed |
| `anthropic/claude-opus-4-7` | parked | available, not yet routed |
| `anthropic/claude-opus-4-8` | parked | available, not yet routed |
| `anthropic/claude-opus-5` | routed | long-horizon coding escalation; model-paired review |
| `anthropic/claude-opus-5-5` | alias | `anthropic/claude-opus-5` |
| `anthropic/claude-sonnet-4-5` | parked | available, not yet routed |
| `anthropic/claude-sonnet-4-5-20250929` | alias | `anthropic/claude-sonnet-4-5` |
| `anthropic/claude-sonnet-4-6` | parked | available, not yet routed |
| `anthropic/claude-sonnet-5` | routed | daily driver; complementary native review |
| `devin/swe-1-6` | parked | available, not yet routed |
| `devin/swe-1-7` | routed | long-horizon coding escalation |
| `openai-codex/gpt-5.3-codex-spark` | parked | available, not yet routed |
| `openai-codex/gpt-5.5` | parked | available, not yet routed |
| `openai-codex/gpt-5.6-luna` | alias | `openai-codex/gpt-6-luna` |
| `openai-codex/gpt-5.6-sol` | alias | `openai-codex/gpt-6-sol` |
| `openai-codex/gpt-5.6-terra` | routed | daily driver; complementary native review |
| `openai-codex/gpt-6-astra` | routed | model-paired review |
| `openai-codex/gpt-6-luna` | routed | cheap helper chores; model-paired review |
| `openai-codex/gpt-6-sol` | routed | long-horizon coding escalation; model-paired review |
| `WandB-Inference/deepseek-ai/DeepSeek-V3.1` | parked | available, not yet routed |
| `WandB-Inference/deepseek-ai/DeepSeek-V4-Flash` | parked | available, not yet routed |
| `WandB-Inference/deepseek-ai/DeepSeek-V4-Flash-0731` | parked | available, not yet routed; 262,144-token configured limit differs from V4 Flash |
| `WandB-Inference/deepseek-ai/DeepSeek-V4-Pro` | routed | very large context analysis; model-paired review |
| `WandB-Inference/deepseek-ai/DeepSeek-V4-Pro-0813` | alias | `WandB-Inference/deepseek-ai/DeepSeek-V4-Pro` |
| `WandB-Inference/deepseek-ai/DeepSeek-V4.1-Flash` | parked | available, not yet routed |
| `WandB-Inference/google/gemma-4-26B-A4B-it` | parked | available, not yet routed |
| `WandB-Inference/google/gemma-4-31B-it` | parked | available, not yet routed |
| `WandB-Inference/ibm-granite/granite-4.1-8b` | parked | available, not yet routed |
| `WandB-Inference/ibm-granite/granite-4.2-8b` | parked | available, not yet routed |
| `WandB-Inference/JetBrains/Mellum2-12B-A2.5B-Instruct` | parked | available, not yet routed |
| `WandB-Inference/meta-llama/Llama-3.1-70B-Instruct` | parked | available, not yet routed |
| `WandB-Inference/meta-llama/Llama-3.1-8B-Instruct` | parked | available, not yet routed |
| `WandB-Inference/meta-llama/Llama-3.3-70B-Instruct` | parked | available, not yet routed |
| `WandB-Inference/MiniMaxAI/MiniMax-M3` | routed | long-horizon coding escalation |
| `WandB-Inference/moonshotai/Kimi-K2.6` | parked | available, not yet routed |
| `WandB-Inference/moonshotai/Kimi-K2.7-Code` | routed | long-horizon coding escalation; explicit third-leg review |
| `WandB-Inference/nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B` | parked | available, not yet routed |
| `WandB-Inference/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B` | parked | available, not yet routed |
| `WandB-Inference/openai/gpt-oss-120b` | routed | cheap helper chores |
| `WandB-Inference/openai/gpt-oss-20b` | parked | available, not yet routed |
| `WandB-Inference/OpenPipe/Qwen3-14B-Instruct` | parked | available, not yet routed |
| `WandB-Inference/Qwen/Qwen3-30B-A3B-Instruct-2507` | parked | available, not yet routed |
| `WandB-Inference/Qwen/Qwen3.5-35B-A3B` | routed | cheap helper chores |
| `WandB-Inference/Qwen/Qwen3.6-27B` | parked | available, not yet routed |
| `WandB-Inference/Qwen/Qwen3.6-35B-A3B` | parked | available, not yet routed |
| `WandB-Inference/Qwen/Qwen3.8-27B` | parked | available, not yet routed |
| `WandB-Inference/zai-org/GLM-5.2` | routed | daily driver |
| `WandB-Inference/zai-org/GLM-5.3-Flash` | parked | available, not yet routed |
<!-- model-catalog:end -->

## Serving differences that matter

- `WandB-Inference` uses OpenAI-compatible completions at
  `api.inference.wandb.ai`. Configured context and maximum-output values vary
  by model from 32,768 to 1,048,576 tokens. These are provider metadata, not
  measured usable limits.
- Native Anthropic and OpenAI Codex models accept Pi thinking levels. The W&B
  provider does not expose Pi reasoning-effort control, even when a model
  reports reasoning support.
- Long tool-heavy runs and deep-thinking workloads can behave differently on
  OpenAI-compatible serving. Prefer native providers until measured otherwise.

## House rules

- Prefer W&B Inference for helper chores and explicit third-leg reviews where
  it is plausibly sufficient. That produces usage data the team can act on.
- Park a model instead of guessing its role.
- Check linked sources before repeating a model claim elsewhere. Catalogs
  drift.
