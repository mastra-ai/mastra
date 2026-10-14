---
'@mastra/memory': patch
---

Knowledge semantic search now asks Knowledge storage which hits the caller may see, using the same node and record visibility rules as every other Knowledge read. A vector whose metadata is out of date (written before a node or record was rescoped, or by an indexing worker whose claim had expired) can no longer show content outside the caller's current scopes. Records that mention a node the caller cannot see stay hidden, and scope nodes are returned to callers who hold that scope.
