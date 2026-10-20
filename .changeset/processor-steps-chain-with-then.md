---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed a TypeScript error (TS2345) when chaining processor steps with `.then()` or `.parallel()`. Steps built with `createStep(processor)` now accept the output of a previous processor step, so the output guardrails workflow from the docs type-checks:

```ts
const workflow = createWorkflow({
  id: 'output-guardrails',
  inputSchema: ProcessorStepSchema,
  outputSchema: ProcessorStepSchema,
})
  .then(createStep(new TokenLimiterProcessor({ limit: 1000 })))
  .then(createStep(new BatchPartsProcessor()))
  .commit();
```
