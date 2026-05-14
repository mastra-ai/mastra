---
'@mastra/core': minor
---

Added Harness v1 workspace integration with shared, per-resource, and per-session ownership models.

Adds the `WorkspaceProvider` contract (`providerId`, `resumable`, `create`, `resume`, optional `destroy`) plus `nonDurableProvider()` shorthand. `HarnessConfig.workspace` now accepts a discriminated union over the three ownership kinds; the `WorkspaceRegistry` handles lifecycle (lazy / eager provisioning, refcounting, state persistence via `pushState`).

- `Session.getWorkspace()` resolves the workspace per ownership model and caches the result.
- `HarnessRequestContext.workspace` is typed (was `unknown`) so tools see the resolved `Workspace`.
- Subagent `workspace: 'inherit' | 'fresh'` is enforced — `'fresh'` is rejected at config time outside `kind: 'per-session'`.
- Per-session state is persisted into `SessionRecord.workspace` so resumable providers can rehydrate across restarts. Mismatched providers surface `HarnessWorkspaceProviderMismatchError` at hydrate time.
- New error classes: `HarnessWorkspaceProviderMismatchError`, `HarnessWorkspaceLostError`, `HarnessWorkspaceProvisioningError`, `HarnessWorkspaceInUseError`.
- New events: `workspace_status_changed`, `workspace_error`.
- New exports from `@mastra/core/harness/v1`: `WorkspaceProvider`, `WorkspaceProviderContext`, `WorkspaceOwnershipKind`, `nonDurableProvider`, `HarnessWorkspaceConfig`.

```ts
const harness = new Harness({
  /* ... */
  workspace: {
    kind: 'per-resource',
    create: async ({ resourceId }) => {
      return new LocalWorkspace({ basePath: `/workspaces/${resourceId}` });
    },
  },
});

const session = await harness.session({ resourceId: 'tenant-42' });
const workspace = await session.getWorkspace();
```
