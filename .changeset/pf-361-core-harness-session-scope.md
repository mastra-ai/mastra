---
'@mastra/core': patch
---

Improved Harness session resource isolation. `Harness.closeSession()` can now scope a close request by `resourceId`, and `Session.listMessages()` now returns only messages for the session resource.

Added Harness RBAC permissions for resource-scoped session operations while preserving stored-resource compatibility.

```ts
await harness.closeSession({ sessionId: 'session-1', resourceId: 'res-123' });
```
