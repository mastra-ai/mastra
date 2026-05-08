### 12.13 Workspace ownership shapes

```ts
import { Harness, LocalWorkspace } from '@mastra/core/harness/v1';
import { E2BWorkspace } from '@mastra/workspace-e2b';

// Shape 1 — shared (single-user TUI). Sugar form: bare Workspace.
new Harness({
  /* ... */
  workspace: new LocalWorkspace({ basePath: process.cwd() }),
});

// Shape 2 — per-resource (multi-tenant server).
new Harness({
  /* ... */
  workspace: {
    kind: 'per-resource',
    create: async ({ resourceId }) => {
      return new LocalWorkspace({ basePath: `/workspaces/${resourceId}` });
    },
  },
});

// Shape 3 — per-session (Devin-style), durable across server restarts.
// Use the full `WorkspaceProvider` shape so the harness can validate
// resumability at startup and persist provider state.
import { e2bWorkspaceProvider } from '@mastra/workspace-e2b';

new Harness({
  /* ... */
  workspace: {
    kind: 'per-session',
    provider: e2bWorkspaceProvider({ template: 'node-22' }),
    // The provider exposes:
    //   providerId: 'e2b'
    //   resumable: true
    //   create({ sessionId, ... })            -> live Workspace
    //   resume({ state, sessionId, ... })     -> live Workspace
  },
});

// Sugar form (factory shorthand). Equivalent to a `WorkspaceProvider` with
// `resumable: false` — sessions provisioned this way DO NOT survive server
// restarts. Use it for ephemeral workloads only.
new Harness({
  /* ... */
  workspace: async ({ sessionId }) => {
    return E2BWorkspace.create({ template: 'node-22', name: sessionId });
  },
});

// Tearing down a per-resource workspace (e.g. user deleted their account).
// Throws if any session for that resource is still live; close them first.
await harness.destroyResourceWorkspace({ resourceId: 'tenant-42' });
```
