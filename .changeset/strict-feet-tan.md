---
'@mastra/core': minor
---

Moved workspace and browser ownership from the Harness to individual sessions. `createSession` now accepts optional `workspace` and `browser` overrides that are passed directly to the `Session` constructor. When no override is provided, the Harness-level config is used as a fallback.

**Breaking changes:**

- `Session` constructor now requires `workspace: Workspace` and accepts optional `browser?: MastraBrowser`
- `HarnessConfig.workspace` no longer accepts a `WorkspaceConfig` object — pass a `Workspace` instance or a dynamic factory function
- `createSession` overrides accept static `Workspace` / `MastraBrowser` instances only (not `DynamicArgument`)
- Removed `Harness.destroyWorkspace()` — workspace lifecycle is now driven by per-session `workspace_status_changed`, `workspace_ready`, and `workspace_error` events emitted after `workspace.init()` completes
- `Harness.getWorkspace()` returns the static workspace instance only (returns `undefined` for dynamic factory configs); use `resolveWorkspace({ session })` to resolve and cache a factory outside the request flow
- `Harness.resolveWorkspace()` now requires a `session` parameter to resolve dynamic factories against the session's request context
- The `SessionBus` replays the last workspace lifecycle event group to subscribers that attach after session creation, so late listeners always learn the current workspace status

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

// workspace can be overridden per session with a static instance
const session = await harness.createSession({
  resourceId: 'user-1',
  ownerId: 'owner-1',
  id: 'session-1',
  workspace: new Workspace({ name: 'ws-1' }),
});

// for dynamic per-request workspaces, use the harness-level config
const harness2 = new Harness({
  name: 'my-harness',
  workspace: ({ requestContext, mastra }) => new Workspace({ name: `ws-${requestContext.session.id}` }),
});
```
