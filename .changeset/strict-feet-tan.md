---
'@mastra/core': major
---

Moved workspace and browser ownership from the Harness to individual sessions.

`createSession` now accepts optional `workspace` and `browser` overrides that are resolved per-session and passed directly to the `Session` constructor. When no override is provided, the Harness-level config is used as a fallback. Workspace is now required at session construction time — the `Session` constructor validates it is a `Workspace` instance and throws if missing.

**Breaking changes:**

- `Session` constructor now requires `workspace: Workspace` and accepts optional `browser?: MastraBrowser`
- `HarnessConfig.workspace` no longer accepts a `WorkspaceConfig` object — pass a `Workspace` instance or a dynamic factory function
- Removed `Harness.getWorkspace()`, `Harness.resolveWorkspace()`, `Harness.hasWorkspace()`, `Harness.isWorkspaceReady()`, and `Harness.destroyWorkspace()` — workspace is now accessed via the session

**Before:**

```ts
const harness = new Harness({
  name: 'my-harness',
  workspace: { name: 'my-workspace' }, // WorkspaceConfig shorthand
});

const session = await harness.createSession({
  resourceId: 'user-1',
  ownerId: 'owner-1',
  id: 'session-1',
});

// workspace resolved lazily by the harness
const ws = harness.getWorkspace();
```

**After:**

```ts
import { Workspace } from '@mastra/core';

const harness = new Harness({
  name: 'my-harness',
  workspace: new Workspace({ name: 'my-workspace' }),
});

// workspace can be overridden per session
const session = await harness.createSession({
  resourceId: 'user-1',
  ownerId: 'owner-1',
  id: 'session-1',
  workspace: ({ requestContext, mastra }) =>
    new Workspace({ name: `ws-${session.id}` }),
});
```
