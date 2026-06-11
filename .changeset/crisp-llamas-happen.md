---
'@mastra/core': minor
---

You can now execute workflows, tools, and memory thread checks as a trusted actor, such as a background job or scheduled task. Pass an `actor` object to identify the system process making the call while keeping fine-grained authorization checks tenant-scoped.

```ts
const actor = { actorKind: 'system', sourceWorkflow: 'nightly-sync' } as const;

await workflow.execute({ ...executeOptions, actor });
await tool.execute(input, { ...toolOptions, actor });
await MastraMemory.checkThreadFGA({ ...threadFGAOptions, actor });
```
