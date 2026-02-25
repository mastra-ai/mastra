---
'@mastra/rag': patch
---

Fixed severe performance bottleneck in token-based chunking (`token` and `semantic-markdown` strategies). Eliminated redundant tiktoken encoder instantiation and excessive token re-encoding during section merging, resulting in significantly faster chunking for markdown knowledge bases.
