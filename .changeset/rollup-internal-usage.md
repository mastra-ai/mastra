---
"@mastra/observability": minor
---

Roll up token usage from internal MODEL_GENERATION spans onto the closest exported ancestor span. When `tracingPolicy.internal` filters a model call out of exported traces, its tokens used to disappear from both the trace UI and metrics. Now:

- The visible ancestor (e.g. `PROCESSOR_RUN`, `AGENT_RUN`) gets an `internalUsage` attribute summing the tokens consumed by its hidden descendants — so a Mastra-owned processor that runs an internal agent (moderation, PII detector, structured output, etc.) shows its aggregate cost on the visible `PROCESSOR_RUN` span.
- Token / cost metrics still emit, but are attributed via labels to the visible ancestor instead of the hidden agent.

No action required — the rollup applies automatically whenever an internal `MODEL_GENERATION` ends inside a non-internal ancestor.
