---
'@mastra/core': patch
---

Scheduled workflows can now run nested workflows when fine-grained authorization (FGA) is configured. Scheduled runs have no end user, so nested workflows were denied with `FGADeniedError`. Set a trusted `actor` on the schedule, together with `requestContext.organizationId`, and every fire (including manual runs) carries it:

```ts
createWorkflow({
  id: 'nightly-sync',
  schedule: {
    cron: '0 2 * * *',
    requestContext: { organizationId: 'org_123' },
    actor: { actorKind: 'system', sourceWorkflow: 'nightly-sync' },
  },
});
```

`actor` can only be set from code (`createWorkflow({ schedule })`, `mastra.schedules.create()` and `mastra.schedules.update()`); the HTTP schedules API does not accept it. Schedules without an actor still fail closed. Fixes #28677.
