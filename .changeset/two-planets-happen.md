---
'@mastra/core': minor
---

Removed `model` and `provider` from thread rows returned by `queryThreads()` with a `timeRange` request. A thread can contain many model calls, so a single model and provider was misleading, and looking them up made thread pages slow.

Thread pages now default to 25 rows and allow at most 100 (previously 100 and 1,000). Requests with a larger `page.limit` now fail validation. Use `page.next` to load further pages.

**Before**

```ts
const { threads } = await client.queryTraceThreads({ timeRange: { traces: range }, page: { limit: 500 } });
threads[0].model; // "gpt-4o"
```

**After**

```ts
const { threads, page } = await client.queryTraceThreads({ timeRange: { traces: range }, page: { limit: 100 } });
// threads[0].model no longer exists; query the thread's spans for model usage
const next = await client.queryTraceThreads({ timeRange: { traces: range }, page: { limit: 100, after: page.next! } });
```
