---
'@mastra/core': patch
---

Fixed duplicate outer workflow starts and retained the outer run identity for nested callbacks.

Tools running inside nested default or evented workflows can read `context.workflow.rootRun` to find the outer `workflowId` and `runId`, then resume that run by its suspension label. Older snapshots may omit this field. Repeated outer starts reject with `WORKFLOW_START_ALREADY_CLAIMED` when the storage adapter supports atomic starts.
