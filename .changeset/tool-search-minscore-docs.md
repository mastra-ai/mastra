---
'@mastra/core': patch
---

Corrected the `ToolSearchProcessor` `search.minScore` documentation. Scores are raw BM25 relevance plus name-match boosts and can exceed 1, rather than falling in a 0-1 range.
