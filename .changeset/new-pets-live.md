---
'@mastra/otel-exporter': patch
'@mastra/arize': patch
---

Renamed two emitted OTel GenAI usage attributes to match the OpenTelemetry GenAI semantic conventions registry (`gen_ai.usage.cache_read.input_tokens` and `gen_ai.usage.cache_creation.input_tokens`, both added to the registry in semconv `v1.40.0` which `@mastra/otel-exporter` already depends on):

- `gen_ai.usage.cached_input_tokens` → `gen_ai.usage.cache_read.input_tokens`
- `gen_ai.usage.cache_write_tokens` → `gen_ai.usage.cache_creation.input_tokens`

The math is unchanged: `gen_ai.usage.input_tokens` remains the total prompt-token count, and the cache attributes are subsets of it (per spec). `@mastra/arize` is updated in lockstep so its OpenInference translation continues to receive cache values.

**Why this matters**: spec-compliant downstream backends — including current Langfuse Cloud (`v3.172.0`+, server-side fix from [langfuse#13110](https://github.com/langfuse/langfuse/pull/13110)) — recognize the new names and not the old ones. Mastra users on Langfuse with prompt caching active have been seeing inflated input-token totals because Langfuse's normalizer didn't recognize Mastra's emitted names; this rename resolves that.

**Action required for direct consumers of these attributes**: any custom dashboard, alert, or query keyed off the old names needs to be updated to the new names.

**Bump-level note**: this changeset uses `patch`, but the change is technically observable to anyone reading the old names. The bump level is part of the upstream discussion on the linked issue (see [mastra-ai/mastra#15962](https://github.com/mastra-ai/mastra/issues/15962)) — `patch`, `minor`, `major`, or dual-emit transition are all options. Adjust before release if needed.
