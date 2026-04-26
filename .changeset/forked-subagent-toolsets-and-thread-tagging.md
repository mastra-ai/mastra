---
'@mastra/core': patch
---

Forked subagents now inherit the parent agent's toolsets (so harness-injected tools like `ask_user` and `submit_plan` remain available inside a fork) with the `subagent` tool itself stripped to prevent unbounded recursive forking. Fork threads are tagged with `metadata.forkedSubagent: true` and `metadata.parentThreadId`, and `Harness.listThreads()` hides them by default so they don't surface in user-facing thread pickers; pass `includeForkedSubagents: true` to opt back in for admin/debug tooling.
