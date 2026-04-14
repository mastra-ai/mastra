---
'@mastra/observability': patch
'@mastra/sentry': patch
---

Fixed Sentry error stack traces so they point to the actual error origin instead of the Mastra exporter internals.

Two related fixes:

- **@mastra/sentry**: The exporter now passes an `Error` object (preserving the captured stack) to `Sentry.captureException` instead of a bare message string. Previously, passing a string caused Sentry to synthesize a stack trace from the exporter's call site, so every error in Sentry appeared to originate from `SentryExporter.handleSpanEnded`.
- **@mastra/observability**: When a span is failed with a `MastraError` that wraps another error, `span.errorInfo.stack` now prefers the original cause's stack over the wrapper's stack, so downstream exporters receive the stack pointing to the true error origin.

Fixes #15337.
