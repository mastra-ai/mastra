---
'@mastra/inngest': patch
---

Fixed scores from `createInngestAgent` agents so they show on the agent run in a trace. Before, the score pointed at a span that was never stored, so the trace showed no scores for the run.
