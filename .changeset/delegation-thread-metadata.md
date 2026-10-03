---
'@mastra/core': minor
---

Added `threadMetadata` to the `onDelegationStart` return value so delegated sub-agent threads can carry metadata such as a tenant ID. The metadata is applied when the sub-agent thread is created, which makes those threads findable with metadata-filtered queries.

```ts
await supervisor.generate('Summarize the report', {
  memory: { thread: 'parent-thread', resource: 'user-1' },
  delegation: {
    onDelegationStart: () => ({ threadMetadata: { tenantId: 'acme' } }),
  },
});

await memory.listThreads({ filter: { metadata: { tenantId: 'acme' } } });
```
