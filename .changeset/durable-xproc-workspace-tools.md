---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fix `ToolNotFoundError` for workspace/skill tools (`skill`, `skill_read`, `skill_search`, `mastra_workspace_*`) when a durable agent's steps execute on a cross-process engine (e.g. the `@mastra/inngest` `connect()` worker).

The durable tool-call step resolved tools only from the per-process `globalRunRegistry` plus Mastra-instance-level tools, while the sibling LLM-execution step already rebuilds the full toolset from the agent via `resolveRuntimeDependencies`/`getToolsForExecution`. On a worker process the registry is empty, so the model could *call* `skill` (the LLM step saw it) but the tool-call step rejected it with `ToolNotFoundError`. The tool-call step now falls back to rebuilding the toolset from the agent (`rebuildRunToolsFromMastra`) when the registry misses, resolving workspace/skill tools symmetrically cross-process.

`resolveRuntimeDependencies` also now rebuilds `inputProcessors`/`outputProcessors` (and writes the rebuilt tools + processors back into `globalRunRegistry`) when the registry entry is a cross-process placeholder, so the `SkillsProcessor` and `WorkspaceInstructionsProcessor` run cross-process too — restoring the available-skills list and workspace instructions in the system prompt on the worker.

Placeholder registry entries are detected via a new explicit `RunRegistryEntry.isPlaceholder` flag (set by `@mastra/inngest` when seeding resume-segment entries) or the absence of a live model instance — never by an empty `tools` map, which is a legitimate state for agents configured without tools.

Fixes #19330.
