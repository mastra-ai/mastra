---
'@mastra/core': patch
---

Fixed `timeTravel()` on a failed `.foreach()` step re-running iterations that had already succeeded, which duplicated their side effects (publishing, billing, uploads, notifications).

A failed foreach now records which iterations completed, so re-entering the step only runs the ones that did not.

```ts
const run = await workflow.createRunAsync();
await run.start({ inputData: { items: [1, 2] } }); // item 2 fails

// Previously both items ran again. Now only item 2 runs.
await run.timeTravel({ step: 'process-item' });
```

Fixes #21749
