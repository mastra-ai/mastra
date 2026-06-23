---
'@mastra/chroma': patch
---

Fixed similarity scoring in `ChromaVector.query()` for non-cosine indexes.

- Euclidean indexes now return bounded, positive scores instead of unbounded negative ones.
- Dotproduct indexes now use the correct score conversion.
- A missing distance now scores `0` instead of a perfect `1`.
- `minScore` filtering and rerank weighting now behave consistently with the other Mastra vector stores.
