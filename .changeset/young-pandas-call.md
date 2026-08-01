---
'@mastra/client-js': minor
---

Stored-workflow client API.

New `StoredWorkflow` resource and client methods for the stored-workflow endpoints:

```ts
const { workflows } = await client.listStoredWorkflows({ status: 'active' });
await client.upsertStoredWorkflow({ id: 'greeting-workflow', /* definition */ });

const stored = client.getStoredWorkflow('greeting-workflow');
const definition = await stored.details();
await stored.delete();
```

Workflow list/detail responses also gain an `origin` field (`'code' | 'stored'`) indicating how the workflow entered the live registry.
