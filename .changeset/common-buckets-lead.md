---
'@mastra/posthog': minor
---

Fixed `$ai_tools` in PostHog listing tools the model did not receive. Each call to the model provider is now exported as its own `$ai_generation` event with the model, token usage, input, output, and the tools sent on that call.

**What changes in PostHog**

- A run that calls the model several times now sends one `$ai_generation` event per call, where it sent one per run before. The number of `$ai_generation` events goes up for multi-step runs.
- The span that wraps those calls is now sent as `$ai_span` without token usage, so tokens and cost are not counted twice. Total cost per trace does not change.
- With `@mastra/core` or `@mastra/observability` versions that do not record a span per model call, events are exported as before.
