---
'@mastra/core': minor
'@mastra/pg': patch
---

Added multi-tenant scoping to stored scorer definitions. Stored scorers now persist optional `organizationId` and `projectId` on the definition record, and `list`/`listResolved` accept matching filters to scope results by tenant. The Postgres adapter backfills the new columns and applies the scoped filters; tenancy lives on the record while version snapshots stay pure config.

```ts
await storage.create({
  scorerDefinition: { id, organizationId: 'org-a', projectId: 'proj-1', ...config },
});

const { scorerDefinitions } = await storage.list({
  status: 'draft',
  organizationId: 'org-a',
  projectId: 'proj-1',
});
```
