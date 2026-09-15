---
'@mastra/otel-exporter': minor
---

Export token usage on the model call span only, so Langfuse, Phoenix and other OpenTelemetry backends count each call once and show per-call usage.

Previously the generation span (the whole agent loop) was exported as the `chat` call with the loop's total usage, and the model step and inference spans exported nothing. Backends could not show which call consumed the tokens, where output hit the length limit, or how the cache hit ratio changed between calls.

Now `model_inference` is exported as `chat {model}` with `gen_ai.request.model`, the messages, `gen_ai.usage.*` and `gen_ai.response.*`. `model_generation` becomes a parent span named `model_generation {model}` without model or usage attributes, and `model_step` becomes `agent_step` with `mastra.model_step.step_index` and `is_continued`. When paired with an older `@mastra/observability` that does not emit inference spans, the generation span keeps the `chat` role as before. Fixes #23872.
