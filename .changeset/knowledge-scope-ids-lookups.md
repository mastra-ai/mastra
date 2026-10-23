---
'@mastra/core': minor
---

**Breaking (experimental Knowledge API):** `Knowledge.getNodeByName`, `Knowledge.resolveNode` and `Knowledge.listActivity` now take canonical scope node ids (`scopeIds`) instead of a scope path (`scope`). `Knowledge.rescopeKnowledge` is removed.

Before:

```ts
await knowledge.getNodeByName({ name: 'Alice', scope: ['org:acme', 'resource:alice'] });
```

After:

```ts
const scope = await (await knowledge.getStorage()).getScopeAddress('resource:alice');
await knowledge.getNodeByName({ name: 'Alice', scopeIds: [scope!.scopeNodeId] });
```

Knowledge data written by `@mastra/core` 1.76 is replaced, not migrated, the first time the new storage opens it. To keep it, export it before upgrading.
