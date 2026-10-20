---
'@mastra/factory': minor
---

Anyone who can open a project's Knowledge page can now see its importers, import runs and transcripts. Narrow that with `knowledge.importOperator`, which receives the authenticated org, user and project and decides.

```ts
new MastraFactory({
  knowledge: {
    key: 'default',
    instance: knowledge,
    importOperator: ({ orgId, userId }) => isOrgAdmin(orgId, userId),
  },
});
```
