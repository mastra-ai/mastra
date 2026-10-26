---
'@mastra/observability': patch
'@mastra/core': patch
---

Added `entityVersionId` to exported spans, and stored spans now take their version from it instead of from inherited metadata, so a span is stored with its own entity's version only (#28418).
