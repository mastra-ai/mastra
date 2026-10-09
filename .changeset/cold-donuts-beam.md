---
'@mastra/observability': patch
---

Fixed cost estimates leaving out reasoning tokens. Reasoning tokens now use the output price when a model has no separate reasoning price, so estimated costs for reasoning models go up to match what providers bill.
