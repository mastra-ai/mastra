---
'@internal/playground': patch
'@mastra/react': patch
---

Improved Studio tool calls so generic tools, workflows, sub-agents, Code Mode, plan reviews, and loading states use the compact MastraCode Factory presentation while preserving their custom content, specific icons, transcript spacing, and tool/workflow/agent entity colors. Tool sequences now align their icons with streamed text, keep hover surfaces unclipped, and use correctly layered rails; workflow navigation opens the exact run, sub-agent events align consistently, plan approval actions stay compact when expansion is unavailable, and hidden task signals no longer leave empty transcript rows. Completion checks are shown consistently for both direct agent and supervisor results. Persisted agent-network results are restored as structured tool calls instead of exposing their internal JSON envelope after a stream completes or a thread reloads.
