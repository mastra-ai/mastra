---
'@mastra/temporal': minor
---

Added `run.timeTravel()` support for top-level sequential Temporal workflow steps. Time travel preserves the Mastra run ID, workflow state, and successful pre-target step results while starting a new auditable Temporal execution that re-runs the selected step and subsequent steps.

```ts
const result = await run.timeTravel({
  step: 'review',
  inputData: { draft: revisedDraft },
});

if (result.status === 'suspended') {
  await run.resume({ step: 'approval', resumeData: { approved: true } });
}
```

Time-traveled executions can suspend and resume normally. Nested workflow, foreach, loop, and inner parallel or conditional targets are not yet supported, and `timeTravelStream()` remains unsupported.
