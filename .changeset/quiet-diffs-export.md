---
'@mastra/core': minor
---

Added `diffResponseMessages` and the `ResponseMessagesCursor` type to `@mastra/core/agent/durable` for durable agent integrations outside core, such as `@mastra/inngest`. They build the step events that carry only the response messages that changed since the previous step, which `observe()` and callers rebuild into the full list.
