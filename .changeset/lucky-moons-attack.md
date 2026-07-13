---
'@mastra/client-js': patch
'@mastra/server': patch
'mastra': patch
---

Added an optional session scope to the agent controller API so clients can address independent sessions that share one resource (for example one session per git worktree).

Session routes now accept a `sessionScope` query parameter, and `AgentController.session()` in the client accepts a scope that travels on every request:

```ts
const controller = client.getAgentController('code');

// Address the worktree's own session instead of the shared one:
const session = controller.session('repo-123', '/worktrees/feature-a');
await session.create({ tags: { projectPath: '/worktrees/feature-a' } });
await session.sendMessage('hello');
```

Requests without a scope behave exactly as before.
