---
'@mastra/observability': patch
---

Fixed a startup crash on older `@mastra/core` versions by defining two small id helpers locally instead of importing them from core.

This package imported `generateSignalId` and `resolveExportedSpanId` from `@mastra/core/observability`. Both are recent additions to core — `generateSignalId` in 1.26.0, `resolveExportedSpanId` in 1.63.0 — while the declared peer range still accepted `@mastra/core` from 1.16.0 up. A named ESM import of an export that does not exist fails when Node links the module graph, so an older core installed with no warning and then took the whole app down before any application code ran:

```
SyntaxError: The requested module '@mastra/core/observability'
does not provide an export named 'resolveExportedSpanId'
```

Most projects never named this package — it arrives as a transitive dependency of an observability exporter such as `@mastra/langfuse` or `@mastra/otel-exporter` — so the failure typically surfaced first in a deploy.

Both helpers are self-contained: `generateSignalId` wraps `crypto.randomUUID`, and `resolveExportedSpanId` is structurally typed against an optional span method rather than any core class. Keeping local copies removes the version coupling entirely and makes the declared `>=1.16.0` range true again, rather than moving the floor up to 1.63.0.

No API change. If you hit the error above, this release fixes it without requiring a `@mastra/core` upgrade.
