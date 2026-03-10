---
"@mastra/inngest": minor
---

Fixed excessive OTel trace pollution from internal polling fetch calls. When using APM tools like Sentry or Datadog, the polling loop in `getRunOutput()` would generate hundreds of identical GET spans per workflow run, inflating observability costs and making traces harder to read. Polling fetch calls are now wrapped with `suppressTracing()` to eliminate this noise while preserving all user-facing spans.

Closes #13892
