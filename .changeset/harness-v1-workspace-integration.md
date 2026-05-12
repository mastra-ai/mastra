---
'@mastra/core': minor
---

feat(harness): v1 workspace integration — three ownership models (shared / per-resource / per-session) wired into Harness + Session

Adds the `WorkspaceProvider` contract (`providerId`, `resumable`, `create`, `resume`, optional `destroy`) plus `nonDurableProvider()` shorthand. `HarnessConfig.workspace` now accepts a discriminated union over the three ownership kinds; the `WorkspaceRegistry` handles lifecycle (lazy / eager provisioning, refcounting, state persistence via `pushState`).

- `Session.getWorkspace()` resolves the workspace per ownership model and caches the result.
- `HarnessRequestContext.workspace` is typed (was `unknown`) so tools see the resolved `Workspace`.
- Subagent `workspace: 'inherit' | 'fresh'` is enforced — `'fresh'` is rejected at config time outside `kind: 'per-session'`.
- Per-session state is persisted into `SessionRecord.workspace` so resumable providers can rehydrate across restarts. Mismatched providers surface `HarnessWorkspaceProviderMismatchError` at hydrate time.
- New error classes: `HarnessWorkspaceProviderMismatchError`, `HarnessWorkspaceLostError`, `HarnessWorkspaceProvisioningError`, `HarnessWorkspaceInUseError`.
- New events: `workspace_status_changed`, `workspace_error`.
- New exports from `@mastra/core/harness/v1`: `WorkspaceProvider`, `WorkspaceProviderContext`, `WorkspaceOwnershipKind`, `nonDurableProvider`, `HarnessWorkspaceConfig`.
