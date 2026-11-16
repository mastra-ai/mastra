---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
'mastra': patch
---

Add `textSearch` to trace and span aggregate request contracts for supporting stores. Built-in OSS stores don't implement aggregate text search.

```ts
await client.aggregateTraces({ timeRange, textSearch: 'timeout', measures: ['count'] });
```
