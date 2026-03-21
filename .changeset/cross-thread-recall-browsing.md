---
'@mastra/memory': minor
'@mastra/core': patch
---

feat(memory): add cross-thread recall browsing, search, and retrieval config refactor

**Retrieval config refactor:**
- `retrieval` option now accepts `true` (current-thread browsing), `{ vector: true }` (+ semantic search), `{ scope: 'resource' }` (cross-thread browsing), or `{ vector: true, scope: 'resource' }` (cross-thread browsing + search)
- `retrieval: true` (boolean) remains backward compatible — scoped to current thread
- Vector/embedder resolved from Memory instance at runtime — no complex objects stored in config

**Retrieval scope:**
- `scope: 'thread'` (default) — recall tool only accesses the current thread
- `scope: 'resource'` — recall tool can list threads, browse other threads, and search across all threads
- Schema and tool description adapt based on scope (thread-scoped tools don't expose cross-thread params)

**Observe-time indexing:**
- New messages are automatically embedded and indexed after observation completes (fire-and-forget)
- Enabled when `retrieval: { vector: true }` and Memory has vector store + embedder configured
- `indexMessagesList()` method added to Memory class for direct message array indexing
- `onIndexMessages` callback passed from Memory to ObservationalMemory processor

**Recall tool enhancements:**
- `mode: "threads"` — list all threads for the current user with IDs, titles, and dates (resource scope only)
- `mode: "search"` — semantic vector search to find messages by content (thread-scoped or cross-thread)
- `threadId` parameter — browse messages in any thread (resource scope only)
- `before`/`after` date filters — narrow thread listing and search results by date range
- `recallThreadFromStart()` — read a thread from the beginning without requiring a cursor
- Clear error message when search is used without vector/embedder configured

**Memory class additions:**
- `searchMessages()` — embed a query and search the vector index filtered by resource
- `indexMessages()` — backfill vector index for a thread's messages (for migration)
- `indexMessagesList()` — index a provided array of messages directly
- Memory constructor now stores vector/embedder even when `semanticRecall` is not configured

**System prompt updates:**
- Updated `OBSERVATION_RETRIEVAL_INSTRUCTIONS` with documentation for thread browsing, search, date filtering, and cross-thread navigation workflows
