---
'@mastra/observability': patch
---

Fixed missing token metrics when a tool call suspends or waits for approval. The model step and inference spans now report its token usage and end as `suspended`. Later approval requests from the same step no longer open empty spans. See #27232.
