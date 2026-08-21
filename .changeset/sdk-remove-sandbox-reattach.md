---
'@mastra/code-sdk': minor
---

Remove the sandbox reattach seam (`@mastra/code-sdk/agents/sandbox-reattach` — `registerSandboxReattach`/`reattachProjectSandbox`) and the state-driven sandbox workspace branch in `getDynamicWorkspace` (`state.projectRepositoryId`/`sandboxId`/`sandboxWorkdir`). Factory resolves session workspaces through its own sandbox callback; the UI-pushed sandbox coordinates in controller state were read by a code path that could no longer execute. The `sandboxId`/`sandboxWorkdir`/`worktreePath` state fields remain accepted for client compatibility but are observability-only.
