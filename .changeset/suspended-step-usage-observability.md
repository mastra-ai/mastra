---
'@mastra/observability': patch
---

Fixed missing token metrics when a tool call suspends or waits for approval. The model step and inference spans for that call now end with its token usage and a `suspended` finish reason, and a later approval request from the same step no longer opens empty model step spans. See #27232.
