---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Fixed sub-agent badges collapsing immediately before the sub-agent finishes its work. The badge now stays expanded while the sub-agent is actively streaming tool calls and responses, and only auto-collapses when the sub-agent truly completes.
