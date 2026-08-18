---
'@internal/playground': patch
'@mastra/react': patch
---

Improved Studio tool calls so generic tools, workflows, sub-agents, Code Mode, plan reviews, and loading states use the compact MastraCode Factory presentation while preserving their custom content, specific icons, transcript spacing, and tool/workflow/agent entity colors. Tool sequences now use correctly layered rails, sub-agent events align consistently, and hidden task signals no longer leave empty transcript rows. Persisted agent-network results are restored as structured tool calls instead of exposing their internal JSON envelope after a stream completes or a thread reloads.
