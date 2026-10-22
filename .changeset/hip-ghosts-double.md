---
'@mastra/observability': patch
'@mastra/core': patch
---

Added `traceState` to `ExportedSpan` so a rebuilt span keeps the trace rules (`requestContextKeys`, `hideInput`, `hideOutput`) it was exported with. Fixes #28111
