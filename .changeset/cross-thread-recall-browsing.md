---
'@mastra/memory': minor
'@mastra/core': patch
---

feat(memory): add cross-thread recall browsing, search, and date filtering

**Recall tool enhancements:**
- `mode: "threads"` — list all threads for the current user with IDs, titles, and dates
- `mode: "search"` — semantic vector search across all threads to find messages by content
- `threadId` parameter — browse messages in any thread, not just the current one
- `before`/`after` date filters — narrow thread listing and search results by date range
- `recallThreadFromStart()` — read a thread from the beginning without requiring a cursor

**Memory class additions:**
- `searchMessages()` — embed a query and search the vector index filtered by resource
- `indexMessages()` — backfill vector index for a thread's messages (for migration)
- Memory constructor now stores vector/embedder even when `semanticRecall` is not configured

**System prompt updates:**
- Updated `OBSERVATION_RETRIEVAL_INSTRUCTIONS` with documentation for thread browsing, search, and date filtering workflows
