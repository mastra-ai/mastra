---
'@mastra/memory': patch
---

Knowledge semantic search no longer fails when another worker is still indexing. If another worker holds the pending index operations, or the backlog is too large to finish in one pass, `search()` now returns results from the current index and logs a warning instead of throwing `StaleKnowledgeSemanticIndexError`. Very recent changes may be missing from that one search. It still throws when this process fails to apply an index operation it claimed, and `drain()` still throws whenever operations remain.
