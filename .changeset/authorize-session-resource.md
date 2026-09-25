---
'@mastra/core': minor
---

Added `authorizeSessionResource` to `AgentController`. When auth maps a signed-in user to a resource (`mapUserToResourceId`), that resource normally overrides the session's own, so running a session that owns a different resource fails with "Thread … belongs to resource … but resource … was provided". Return `true` from the hook for callers your app has authorized, and the controller runs that caller with the session's resource in `MASTRA_RESOURCE_ID_KEY`, so memory, caller-supplied tool connections, and cache scoping use the session's resource. Without the hook, nothing changes.

```ts
const controller = new AgentController({
  id: 'app',
  modes,
  authorizeSessionResource: async ({ resourceId, mappedResourceId, requestContext }) =>
    canUseSession({ sessionResourceId: resourceId, callerResourceId: mappedResourceId, requestContext }),
});
```
