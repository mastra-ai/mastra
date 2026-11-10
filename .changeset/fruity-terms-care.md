---
'@mastra/rag': patch
---

Fixed GraphRAG storing newly added self-links twice. Edge lists, serialized graphs, and random-walk neighbor weights now count new self-links once. Snapshots saved before this fix are restored as-is; rebuild the graph to remove existing duplicates. Fixes #29365.
