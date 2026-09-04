---
'@mastra/core': patch
---

Resolve dynamic agent models at most once per `convertTools` call, shared across all tool sources (toolsets, client tools, memory, workspace, skills, browser, sub-agents, workflows, input-processor tools) instead of once per tool, while keeping zero resolutions for sources without tools. Per-call model overrides (e.g. `generate({ model })`) now apply to every tool source.
