---
'@mastra/factory': patch
'@mastra/core': patch
'@mastra/code-sdk': patch
'mastracode': patch
---

Add a bulk action that applies a Factory project's default model to its already-running work and review sessions. Previously, changing the default model only affected sessions started afterwards, so recovering from a rate-limited model meant switching the model by hand in every open session. `POST /web/factory/projects/:id/apply-default-model` now walks the project's active run bindings and, for each one, writes the project default as the per-mode model on the bound thread. Runs pick it up at their next start, the same path multiplayer model changes already travel. The action is scoped by the work item behind each binding: bindings whose item is gone, belongs to another project, or has left the active stages are skipped. It writes only thread settings and never rebinds a session's thread or its in-memory model selection, both of which are shared per resource and would change what other threads on that session see. The Factory settings UI exposes this beneath the default model picker as a confirmed action, since it reaches into runs that are already in progress.

Export `modeModelKey` and `parseModeModelKey` from `@mastra/core/agent-controller`. The `modeModelId_<mode>` thread setting is the contract between anything that persists a mode's model out of process and `SessionModel.syncFromPersisted`, which reads it back at run start. The key format was previously a module-private helper that seven call sites across the CLI, the SDK, and Factory rebuilt by hand, so renaming it would have left every one of them writing or reading a key nothing else understood, with no failing test to show for it. Those call sites now derive the key from core, and readers that scan a whole thread metadata bag for per-mode models use `parseModeModelKey` instead of their own prefix regex.
