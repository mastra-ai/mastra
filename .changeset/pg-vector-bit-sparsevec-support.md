---
"@mastra/pg": minor
---

Add support for pgvector's `bit` and `sparsevec` vector storage types

This release adds comprehensive support for pgvector's `bit` and `sparsevec` vector types, including:
- New vector types: `bit` (for binary/hamming embeddings) and `sparsevec` (for sparse vectors like BM25/TF-IDF)
- Hamming distance operator (`<~>`) for bit vectors
- New operator classes: `bit_hamming_ops`, `sparsevec_cosine_ops`, `sparsevec_l2_ops`, `sparsevec_ip_ops`
- Type-specific vector formatting and parsing for round-trip support with `includeVector`
- Metric-aware score normalization for hamming, cosine, euclidean, and dotproduct distances
- Smart index defaults: IVFFlat restricted for sparsevec (HNSW only), with automatic fallback
- Version guard requiring pgvector >= 0.7.0 for bit and sparsevec types
- Proper PostgreSQL type handling for `bit` with dimension casting (`bit(N)`)
