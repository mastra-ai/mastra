---
'@mastra/posthog': minor
---

Fixed `$ai_tools` in PostHog listing tools the model did not receive. Each call to the model provider is now exported as its own `$ai_generation` event with the model, token usage, output, the tools sent on that call, and the conversation that call received as `$ai_input` (including full tool arguments and results from earlier calls).

**What changes in PostHog**

- A run that calls the model several times now sends one `$ai_generation` event per call, where it sent one per run before. The number of `$ai_generation` events goes up for multi-step runs.
- The span that wraps those calls is now sent as `$ai_span`. Tokens and cost are counted once, so total cost per trace does not change.
- Runs through the deprecated `generateLegacy()` and `streamLegacy()` methods no longer send `$ai_generation` events, so PostHog shows no tokens or cost for them. Use `generate()` and `stream()` instead.
- With `@mastra/core` or `@mastra/observability` versions that do not record a span per model call, events are exported as before.
