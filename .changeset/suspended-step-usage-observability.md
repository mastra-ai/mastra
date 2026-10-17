---
'@mastra/observability': patch
---

Model step and inference spans now end with token usage and a `suspended` finish reason when a tool call suspends or waits for approval, instead of ending without usage. Token metrics for suspended runs are recorded as a result. See #27232.
