---
"@mastra/core": patch
---

Fix durable agents silently skipping scorers when observability is configured. The agent span is ended in the `map-final-output` workflow step before scorers run, and `runScorer` bails when the forwarded span reports `isValid === false` — so every score was silently dropped. The shared durable scorer helper now drops an invalid span before calling `runScorer`, so scoring proceeds regardless of observability configuration; a live span is still forwarded for trace correlation.
