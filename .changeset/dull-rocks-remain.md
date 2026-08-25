---
'@mastra/core': patch
---

Added an optional `getExportedSpanId()` method to the `Span` interface. It returns the span's own id when the span reaches exporters, and the nearest exportable ancestor's id when the span itself is filtered out by `excludeSpanTypes` or internal-span filtering. Supports the fix that stops logs and metrics from referencing span ids that are never exported.
