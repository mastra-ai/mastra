---
'@mastra/core': minor
---

Added an actor signal to core FGA checks for trusted server-side membership bypasses.

```ts
const actor = { actorKind: 'system', sourceWorkflow: 'nightly-workflow' } as const;
await checkFGA({ ...fgaOptions, requestContext, actor });
await requireFGA({ ...fgaOptions, requestContext, actor });
```
