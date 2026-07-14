---
'@mastra/observability': patch
---

Fixed storage exporters to report persistence failures immediately and retry failed batches automatically with the configured exponential backoff.
