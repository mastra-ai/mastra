---
'@mastra/core': minor
'mastracode': patch
---

Made `harness.createSession()` get-or-create by resourceId and added `harness.getSessionByResource()` so notification delivery runs as the session that owns the target thread.

A resourceId now maps to exactly one durable session per Harness: calling `createSession({ resourceId })` twice returns the same session, so a user/thread always resumes their own session and the in-flight creation is shared by concurrent callers. This is the multi-session behavior a long-running / multiplayer server needs — work can be driven on a thread whether or not a human is currently attached, and it runs with that thread's own model/mode/state instead of an arbitrary session.

**Before**

```typescript
// createSession was a pure factory: two calls for the same resource produced
// two independent sessions, and notification delivery had no way to find
// "the session that owns this resource".
const a = await harness.createSession({ resourceId: 'user-a' });
const b = await harness.createSession({ resourceId: 'user-a' }); // different object
```

**After**

```typescript
const a = await harness.createSession({ resourceId: 'user-a' });
const b = await harness.createSession({ resourceId: 'user-a' }); // same session as a

const session = await harness.getSessionByResource('user-a'); // === a
```

`mastracode` resolves notification stream options from the target resource's session (falling back to the active session's model, then the mode default) so a woken GitHub-signal notification always has a model to run with.
