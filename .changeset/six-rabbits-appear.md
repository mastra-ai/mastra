---
'@mastra/ai-sdk': minor
---

Added `workflowSnapshotToStream` utility to convert a `WorkflowState` (as returned by `getWorkflowRunById`) into an AI SDK-compatible stream. This lets you display historical workflow runs using the same `useChat`-powered UI components used for live workflow streams.

**Example usage:**

```ts
import { workflowSnapshotToStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';

const workflowRun = await mastra.getWorkflow('myWorkflow').getWorkflowRunById(runId);
const stream = workflowSnapshotToStream(workflowRun);
return createUIMessageStreamResponse({ stream });
```
