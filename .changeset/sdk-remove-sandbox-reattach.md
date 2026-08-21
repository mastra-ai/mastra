---
'@mastra/code-sdk': minor
---

Remove the sandbox reattach seam (`@mastra/code-sdk/agents/sandbox-reattach` — `registerSandboxReattach`/`reattachProjectSandbox`) and the state-driven sandbox workspace branch in `getDynamicWorkspace` (`state.projectRepositoryId`/`sandboxId`/`sandboxWorkdir`). Factory resolves session workspaces through its own sandbox callback; the UI-pushed sandbox coordinates in controller state were read by a code path that could no longer execute. The `sandboxId`/`sandboxWorkdir`/`worktreePath` state fields are removed from the state schema entirely — nothing reads them (the workdir is always live-resolved from the sandbox, and the sandbox id is the session id). Old clients still sending them are unaffected: unknown state keys are stripped on parse.
