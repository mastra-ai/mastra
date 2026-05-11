---
'@mastra/core': minor
---

Added workflow state reader helpers to inspect persisted workflow runs and recover suspended or long-running workflows.

The reader exposes suspended steps, resume labels, step payloads, and step outputs from the public WorkflowState returned by workflow.getWorkflowRunById(), and WorkflowState step results now reflect foreach array entries.
