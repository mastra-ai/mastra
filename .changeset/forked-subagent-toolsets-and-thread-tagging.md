---
'@mastra/core': patch
'mastracode': patch
---

Forked subagents now inherit the parent agent's toolsets (so harness-injected tools like `ask_user`, `submit_plan`, and user-configured harness tools remain available inside a fork). The `subagent` tool entry is kept in the inherited toolset with its id, description, and schemas unchanged so the LLM request prefix stays byte-identical to the parent's and the prompt cache continues to hit; recursive forking is blocked at the runtime layer by replacing only the tool's `execute` with a stub that returns a "tool unavailable inside a forked subagent" message. Forked runs allow follow-up steps so the model can recover and answer directly if it accidentally calls that stub. Fork threads are tagged with `metadata.forkedSubagent: true` and `metadata.parentThreadId`, and `Harness.listThreads()` hides them by default so they don't surface in user-facing thread pickers; pass `includeForkedSubagents: true` to opt back in for admin/debug tooling.

Mastra Code now renders forked subagent footers as `subagent fork <parent model id>`, including persisted history reloaded after the live event metadata is gone.
