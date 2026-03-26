---
'@mastra/memory': minor
'@mastra/core': patch
---

feat(memory): add cross-thread recall browsing and observation search

You can now browse recall history across a resource, list available threads, and semantically search observation groups instead of raw message chunks.

```ts
const memory = new Memory({
  storage,
  vector,
  embedder,
  options: {
    threads: {
      generateTitle: false,
    },
    semanticRecall: false,
  },
});

const tools = await memory.listTools({
  threadId: 'thread_123',
  resourceId: 'resource_abc',
  observationalMemory: {
    retrieval: { vector: true, scope: 'resource' },
  },
});

const result = await tools.recall.execute({
  mode: 'search',
  query: 'graph reflection anchor ids',
  limit: 5,
});
```

**What changed:**
- `retrieval` now supports `true`, `{ vector: true }`, `{ scope: 'resource' }`, and `{ vector: true, scope: 'resource' }`
- `mode: "threads"` lists threads for the current resource
- `mode: "search"` searches indexed observation groups in the current thread or across the resource
- `threadId`, `before`, and `after` help narrow browsing and search results
- Search results render richer observation context, including source message ranges and whether the match came from the current thread or older memory

**Indexing behavior:**
- observation groups are indexed automatically when retrieval search is enabled and a vector store + embedder are configured
- historical observation groups can be backfilled into the vector store for existing threads
- observation indexing keeps source ranges so recall can point back to the original raw messages

**Implementation details:**
- tool schemas and descriptions adapt to thread vs resource scope
- thread-scoped recall can list the current thread without requiring a resource ID
- search narrows recall results by thread and date filters, including prefiltering indexed observations by timestamp before semantic lookup when observation timestamps are available
- observational-memory instructions now cover thread browsing, search, date filtering, and cross-thread navigation
