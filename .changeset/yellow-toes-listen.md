---
'@mastra/core': minor
---

Added invoker-bound tool provider connections. Providers now receive the connection kind, toolkit, and live RequestContext so they can execute as the authenticated user without coupling provider identity to the Memory resource. The stored connection ID continues to select the exact provider account.

```typescript
async resolveToolsVNext({ kind, requestContext, connectionId }) {
  if (kind === 'invoker') {
    const userId = requestContext?.get('providerUserId');
    return resolveForUser(userId, connectionId);
  }
}
```
