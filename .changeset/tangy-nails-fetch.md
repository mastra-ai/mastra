---
'@mastra/observability': patch
---

Improved tracing overhead when filtering spans. Spans dropped by `excludeSpanTypes` or the internal-span filter (`includeInternalSpans: false`) now skip payload serialization and retention entirely instead of paying the cost and discarding at export time. This significantly reduces CPU and memory pressure on streaming hot paths, most notably per-chunk `MODEL_CHUNK` spans on tool-calling agents. Exported span data and custom span processors are unaffected.
