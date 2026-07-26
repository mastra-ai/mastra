---
'@mastra/core': patch
---

Fix durable agents dropping `RequestContext` when delegating to a subagent on a cross-process worker (e.g. `createInngestAgent()` with a `connect()` worker).

The durable LLM and tool-call steps rebuild the toolset from `input.requestContextEntries`, but that snapshot is not propagated onto the step input cross-process — only the run-level `RequestContext` (rebuilt from the run event) is available there. The rebuild therefore captured an empty context, so a delegated subagent's tools resolved with no request-scoped values (tenant/user IDs, workspace filesystem, dynamic model/memory) and silently fell back to defaults.

`resolveRuntimeDependencies` and `rebuildRunToolsFromMastra` now fall back to the run-level `RequestContext` when the workflow-input snapshot is absent, so the rebuilt toolset — and any subagent delegated to inside the tool-call step — resolves with the caller's context. This extends the trigger/resume/nested-workflow guarantees from #19223 to the subagent-delegation boundary.
