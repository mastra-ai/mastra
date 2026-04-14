---
'@mastra/observability': patch
'@mastra/sentry': patch
---

Fixed stack traces for errors reported to Sentry. Exceptions now point to the code that threw the error instead of `SentryExporter.handleSpanEnded` inside the exporter, so issues in Sentry are actually debuggable.

This was caused by two issues, both fixed:

- `@mastra/sentry` passed the error message as a string to `Sentry.captureException`, which made Sentry synthesize a stack trace from the exporter's call site. It now passes an `Error` instance with the captured stack attached.
- `@mastra/observability` stored the wrapping `MastraError`'s stack on the span, hiding the original error's location. When the `MastraError` has a cause, the cause's stack is now preserved.

Fixes [#15337](https://github.com/mastra-ai/mastra/issues/15337).
