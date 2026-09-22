---
'@mastra/client-js': patch
---

**Added**

Added methods to `MastraClient.getA2AV1()` to create, get, list, and delete task push-notification configurations without switching to the v0.3 client. List results include pagination metadata.

For an existing `MastraClient` instance, register a callback for a task:

```ts
const a2a = client.getA2AV1('agent-id');
await a2a.createTaskPushNotificationConfig({
  tenant: 'tenant-1',
  id: 'config-1',
  taskId: 'task-1',
  url: 'https://example.com/callback',
  token: 'callback-token',
  authentication: { scheme: 'Bearer', credentials: 'callback-secret' },
});
```
