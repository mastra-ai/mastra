---
'@mastra/observability': patch
---

Added `timeToFirstChunkMs` (time to first chunk, in milliseconds) to model inference and model generation spans, and copied it onto the parent agent run span.
