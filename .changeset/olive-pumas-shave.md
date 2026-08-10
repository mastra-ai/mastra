---
'@mastra/memory': patch
---

Fix Observational Memory undercounting large tool results. Token accounting now serializes tool results in full instead of reusing the Observer-facing representation, which is truncated to 10k tokens. Oversized tool results now push OM past its thresholds and trigger compaction before the provider's context window overflows.
