---
'@mastra/chroma': patch
---

Fixed Chroma vector store score normalization. Scores are now computed per distance metric so euclidean collections return values in (0, 1] instead of negative numbers, matching @mastra/pg and @mastra/duckdb. A missing distance now yields a score of 0 instead of a perfect score of 1.
