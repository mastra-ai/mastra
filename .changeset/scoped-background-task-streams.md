---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed background task events leaking across resources. Previously, calling `BackgroundTaskManager.stream()` without a `resourceId` delivered every resource's task events, including tool arguments and results. Without a `resourceId`, `stream()` now only delivers tasks that have no resource. To subscribe to every resource, pass `allResources: true`:

```ts
const events = mastra.backgroundTaskManager.stream({ agentId: 'my-agent', allResources: true });
```

The `/background-tasks`, `/background-tasks/stream` and `/background-tasks/:backgroundTaskId` routes now use the resource from the request context. A resource-scoped caller only sees its own tasks: requesting a different `resourceId` returns 403, and fetching another resource's task returns 404. An empty resource id in the request context is rejected with 403. Requests without a resource in the request context keep access to all resources.
