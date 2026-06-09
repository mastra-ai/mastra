---
'@mastra/core': minor
---

Added a system actor signal to core FGA checks for trusted server-side membership bypasses.

```ts
const systemActor = { actorKind: 'system', sourceWorkflow: 'nightly-workflow' } as const;
await checkFGA({ ...fgaOptions, requestContext, systemActor });
await requireFGA({ ...fgaOptions, requestContext, systemActor });
```
