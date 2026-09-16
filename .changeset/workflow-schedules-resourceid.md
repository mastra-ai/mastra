---
'@mastra/server': patch
'@mastra/core': patch
---

Allow setting `resourceId` on workflow schedules so scheduled runs are attributed to a resource. The optional `resourceId` is accepted on create and update, returned in schedule responses, and carried through both the scheduler and manual fire paths into the run snapshot — enabling multi-tenant correlation and filtering. Unlike agent schedules (where `resourceId` is part of thread identity), a workflow schedule's `resourceId` is pure run-attribution metadata and can be updated via PATCH. All fields are optional and backward-compatible.

```ts
// Attribute scheduled runs to a resource
const schedule = await mastra.schedules.create({
  workflowId: 'daily-report',
  cron: '0 9 * * *',
  resourceId: 'tenant-123',
});

// resourceId can be updated later
await mastra.schedules.update(schedule.id, { resourceId: 'tenant-456' });
```
