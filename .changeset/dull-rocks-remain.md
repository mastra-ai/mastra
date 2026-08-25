---
'@mastra/core': patch
---

Added an optional `getExportedSpanId()` method to the `Span` interface. It returns the span's own id when the span reaches exporters, and the nearest exportable ancestor's id when it does not.

Suspending workflow and agent runs now use it, so a resumed run links to a span that was actually exported instead of leaving its child spans orphaned in the trace.
