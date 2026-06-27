---
'@mastra/core': minor
---

Added agent and thread identity to processors. Every processor method now receives `agentId`, `agentName`, `threadId`, and `resourceId` so processors can tell which agent, thread, and resource a run belongs to without inspecting `requestContext`. The same fields arrive identically whether the processor runs in-process or as a workflow.

```ts
const myProcessor: Processor = {
  id: 'my-processor',
  processOutputStream: async ({ part, agentId, threadId, resourceId }) => {
    // agentId, threadId, resourceId now available here
    return part;
  },
};
```

The fields are optional and undefined for non-agent or threadless pipelines, so existing processors keep working unchanged.
