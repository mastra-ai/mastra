---
'mastracode': patch
'@mastra/core': patch
---

Fixed subagents being unable to access files outside the project root. Subagents now inherit both user-approved sandbox paths and skill paths (e.g. `~/.claude/skills`) from the parent agent.
