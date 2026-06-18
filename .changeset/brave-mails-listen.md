---
'@mastra/core': patch
---

Fixed harness buildAgentMessageStreamOptions to combine the agent's own dynamic instructions with mode instructions instead of replacing them. Previously, when a shared backing agent had dynamic instructions (e.g. AGENTS.md, project context), passing mode instructions via options.instructions completely overrode them.
