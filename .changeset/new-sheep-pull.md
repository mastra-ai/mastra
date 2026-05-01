---
'@mastra/core': minor
---

Added workflow state reader helpers for inspecting persisted workflow runs.

Use the reader to inspect suspended steps, resume labels, step payloads, and step outputs from the public WorkflowState returned by workflow.getWorkflowRunById().

Example:
```ts
const state = await workflow.getWorkflowRunById(runId);
const reader = createWorkflowStateReader(state);
reader.getSuspendedStep();
reader.getResumeLabel("approve");
reader.getStepOutput("extract-data");
```

This helps applications recover suspended or long-running workflow runs without parsing raw snapshot internals. See https://github.com/mastra-ai/mastra/issues/16044.
