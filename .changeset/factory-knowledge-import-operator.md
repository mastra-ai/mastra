---
'@mastra/factory': minor
---

Decide who can see a project's Knowledge importers, import runs and transcripts with `knowledge.importOperator`. Without it, organization admins can see them, and everyone can when auth is disabled.

```ts
new MastraFactory({
  knowledge: {
    key: 'default',
    instance: knowledge,
    importOperator: ({ userId }) => maintainers.has(userId),
  },
});
```
