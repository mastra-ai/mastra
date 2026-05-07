---
'@mastra/client-js': minor
---

Fix `orderBy` shape mismatch for paginated list methods.

The server expects `orderBy` as a structured object (`{ field, direction }`),
but several SDK methods were sending `orderBy` and `sortDirection` as flat
strings, which caused server-side schema validation to fail.

Affected methods:

- `MastraClient.listMemoryThreads`
- `Agent.listVersions`
- `StoredAgent.listVersions`
- `StoredPromptBlock.listVersions`
- `StoredScorer.listVersions`

Before:

```ts
client.listMemoryThreads({ orderBy: 'createdAt', sortDirection: 'DESC' });
```

After:

```ts
client.listMemoryThreads({ orderBy: { field: 'createdAt', direction: 'DESC' } });
```

The flat `sortDirection` parameter has been removed from the affected param
types in favor of the nested `orderBy.direction` field.
