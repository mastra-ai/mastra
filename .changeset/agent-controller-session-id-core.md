---
'@mastra/core': minor
---

**Breaking:** Agent controller sessions are now addressed by their session id. Many sessions can share one `resourceId`, so `resourceId` only says whose threads and memory a session works on.

- Added `controller.getSession(sessionId)`. Removed `controller.getSessionByResource(resourceId, scope)`.
- Removed the `scope` option from `createSession()`. Give each session its own `id` instead. When `id` is omitted it defaults to the `resourceId`, so existing one-session-per-resource code keeps working.
- `deleteSession()` takes `{ sessionId }`, and `generateThreadTitle()` takes an optional `sessionId`.
- The controller request context exposes `sessionId` next to `resourceId`.

```ts
// Before
await controller.createSession({ resourceId: 'repo-1', scope: 'run-a' });
const session = await controller.getSessionByResource('repo-1', 'run-a');
await controller.deleteSession({ resourceId: 'repo-1', scope: 'run-a' });

// After
await controller.createSession({ id: 'run-a', resourceId: 'repo-1' });
const session = await controller.getSession('run-a');
await controller.deleteSession({ sessionId: 'run-a' });
```
