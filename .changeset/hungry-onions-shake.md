---
'@internal/playground': patch
---

Improved Studio tool calls so generic tools, workflows, sub-agents, Code Mode, plan reviews, and loading states use the compact MastraCode Factory presentation while preserving their custom content, specific icons, transcript spacing, and tool/workflow/agent entity colors. Entity icons now explain their tool, workflow, sub-agent, Code Mode, or completion-check role on hover, while tool names use the muted design-system text color. Tool sequences now align their icons with streamed text, keep hover surfaces unclipped, and use correctly layered rails; workflow navigation opens the exact run, sub-agent events align consistently, plan approval actions stay compact when expansion is unavailable, and hidden task signals no longer leave empty transcript rows. Completion checks are shown consistently for both direct agent and supervisor results.
