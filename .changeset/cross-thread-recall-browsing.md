---
'@mastra/memory': minor
'@mastra/core': patch
---

feat(memory): add recall-tool history retrieval for agents using observational memory

Agents that use observational memory can now use the `recall` tool to retrieve history from past conversations, including raw messages, thread listings, and indexed observation-group memories. Retrieval can be scoped in multiple ways, including current-thread browsing, resource-wide thread browsing, and semantic search over indexed observation groups.

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
- agents using observational memory can use the `recall` tool to browse threads, browse messages, and search indexed observation groups
- `recall` search now returns indexed observation-group memories with source ranges
- `retrieval` now supports `true`, `{ vector: true }`, `{ scope: 'resource' }`, and `{ vector: true, scope: 'resource' }`
- `mode: "threads"` lists threads for the current resource
- `mode: "search"` searches indexed observation groups in the current thread or across the resource
- `threadId`, `before`, and `after` help narrow browsing and search results
- search results render richer observation context, including source message ranges and whether the match came from the current thread or older memory

**Indexing behavior:**
- observation groups are indexed automatically when retrieval search is enabled and a vector store + embedder are configured
- historical observation groups can be backfilled into the vector store for existing threads
- observation indexing keeps source ranges so recall can point back to the original raw messages
- the MastraCode observation backfill path more reliably indexes XML observation groups and older plain-text observation generations while skipping per-thread OM history read failures during rebuilds

**Implementation details:**
- tool schemas and descriptions adapt to thread vs resource scope
- thread-scoped recall can list the current thread without requiring a resource ID
- search narrows recall results by thread and date filters, including prefiltering indexed observations by timestamp before semantic lookup when observation timestamps are available
- observational-memory instructions now cover thread browsing, search, date filtering, and cross-thread navigation
