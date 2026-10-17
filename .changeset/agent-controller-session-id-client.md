---
'@mastra/client-js': minor
---

**Breaking:** `controller.session()` takes a session id, and the resource moves to `create()`. The `scope` argument is removed.

```ts
// Before
const session = client.getAgentController('code').session('repo-1', 'run-a');
await session.create();

// After
const session = client.getAgentController('code').session('run-a');
await session.create({ resourceId: 'repo-1' });
```

`create()` without a `resourceId` resumes the session on the resource it already has, or uses the session id as the resource for a new session, so `session('user-1').create()` behaves as before.
