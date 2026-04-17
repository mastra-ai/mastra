---
'@mastra/observability': patch
---

Improved observability performance when spans are excluded from export.

Spans dropped by `excludeSpanTypes` or by `includeInternalSpans: false` now skip the expensive deep-clean serialization work on create and update paths, which reduces overhead for hot-path spans like `MODEL_CHUNK`.

Tool-result `MODEL_CHUNK` event spans no longer duplicate the full tool result payload. These spans now keep tool identity in metadata and rely on the sibling tool-call span for the full result body.
