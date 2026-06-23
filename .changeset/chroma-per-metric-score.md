---
'@mastra/chroma': patch
---

Fixed `ChromaVector.query()` returning wrong similarity scores for non-cosine collections. Scores were always computed as `1 - distance`, which is only correct for cosine. Euclidean collections returned unbounded negative scores, breaking `minScore` thresholds and rerank weighting and making scores incomparable with other vector stores. Scores are now derived from the collection's actual metric (`euclidean` → `1 / (1 + sqrt(distance))` since Chroma's `l2` space returns squared distances, `dotproduct` → `1 - distance`, `cosine` → `1 - distance`), matching the convention used across the other Mastra vector stores. A missing distance now scores `0` instead of a perfect `1`.
