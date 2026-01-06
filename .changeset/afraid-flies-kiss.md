---
'@mastra/rag': patch
---

Fix invalid filter handling in vector queries and graph-rag searches. Invalid filter inputs now throw explicit errors instead of silently falling back to empty filters, preventing unintended unfiltered results.
