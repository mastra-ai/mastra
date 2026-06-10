---
'@mastra/core': minor
---

You can now execute workflows, tools, and memory thread checks as a trusted system actor, such as a background job or scheduled task. Pass a `systemActor` object to identify the system process making the call while keeping fine-grained authorization checks tenant-scoped.

```ts
const systemActor = { actorKind: 'system', sourceWorkflow: 'nightly-sync' } as const;

await workflow.execute({ ...executeOptions, systemActor });
await tool.execute(input, { ...toolOptions, systemActor });
await MastraMemory.checkThreadFGA({ ...threadFGAOptions, systemActor });
```
