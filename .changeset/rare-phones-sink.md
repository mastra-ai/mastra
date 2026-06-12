---
'@mastra/core': patch
---

Fixed agent runs hanging or stopping silently when a model refuses a turn. Anthropic models such as claude-fable-5 can block a turn server-side and return a refusal, which the AI SDK surfaces as a `content-filter` finish reason.

**Fixed the hang:** the agentic loop treated `content-filter` as "keep going", so it re-sent the same request and re-triggered the refusal on every step — looping until `maxSteps`, or forever when `maxSteps` was unset. `content-filter` is now treated as a terminal finish reason (alongside `stop`, `error`, and `length`), so the run stops instead of hanging.

**Surfaced a clear terminal state:** when a run ends on `content-filter`, `error`, or `length`, it now finalizes into an explicit error state, emits an error event with diagnostic context (including the provider's stop details when available), and reports `agent_end` with reason `'error'` — instead of ending on an empty assistant message that looked like a silent stop.

**Avoided the refusal in the first place:** when the harness runs `claude-fable-5`, it now automatically enables Anthropic's server-side fallback to `claude-opus-4-8` (`providerOptions.anthropic.fallbacks`). If fable-5's safety classifiers block a turn, Anthropic transparently retries it on the fallback model and returns that answer. If the whole chain still refuses, the run ends on the terminal `content-filter` error state described above.

**Made the fallback visible:** when a turn is served by a fallback model (reported via `fallback_message` entries in `providerMetadata.anthropic.iterations`), the harness now emits an `info` event naming the model that actually generated the response, so users know the selected model declined the turn.

**Attributed tracing to the serving model:** the `MODEL_GENERATION` span's `responseModel` attribute now reports the fallback model when a server-side fallback served the turn, so tracing exporters (Langfuse, etc.) attribute usage and cost to the model that actually generated the response instead of the requested model.
