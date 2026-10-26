---
'@mastra/dynamodb': patch
---

Fixed workflow and durable agent resumes that could fail or lose state when a different process resumed a run soon after it suspended. Resumes failed with `AGENT_RESUME_NO_SNAPSHOT_FOUND` or `WORKFLOW_RUN_NOT_SUSPENDED`, or restarted from an earlier iteration and dropped the pre-approval text and suspended tool calls. Workflow snapshot reads by workflow name and run ID now use strongly consistent reads, so they always see the latest write. These reads use about twice the read capacity they did before. `getWorkflowRunById` called without `workflowName` still reads through a secondary index and stays eventually consistent.
