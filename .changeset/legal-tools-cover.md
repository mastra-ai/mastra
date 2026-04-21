---
'@mastra/server': minor
---

Added `forEachIndex` to the workflow resume request body schema. The `/workflows/:workflowId/resume`, `/resume-async`, and `/resume-stream` endpoints (including their agent-builder equivalents) now accept an optional zero-based `forEachIndex` so clients can target a specific iteration of a suspended `.foreach()` step.

```ts
// POST /workflows/:workflowId/resume
// body
{
  step: 'approve',
  resumeData: { ok: true },
  forEachIndex: 1, // resume only the second iteration; others stay suspended
}
```
