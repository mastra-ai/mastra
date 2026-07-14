---
'@mastra/core': minor
---

Added session scoping to `AgentController` so independent sessions can run in parallel over the same resource (for example one session per git worktree).

Previously `createSession()` was get-or-create by `resourceId` alone, so two callers sharing a resource always resolved to the same session — with one run loop, one thread binding, and shared mode/model/state. Passing the new `scope` option creates an independent session per scope:

```ts
// Two independent sessions over the same resource:
const a = await controller.createSession({
  resourceId: 'repo-123',
  scope: '/worktrees/feature-a',
  tags: { projectPath: '/worktrees/feature-a' },
});
const b = await controller.createSession({
  resourceId: 'repo-123',
  scope: '/worktrees/feature-b',
  tags: { projectPath: '/worktrees/feature-b' },
});

// Look up a scoped session later:
const session = await controller.getSessionByResource('repo-123', '/worktrees/feature-a');
```

Calls with the same `resourceId` and `scope` still resume the same session (get-or-create), and unscoped sessions behave exactly as before.
