---
'@mastra/observability': patch
---

Model requests cancelled by a queued signal now get their own `MODEL_INFERENCE` span, ended with finish reason `interrupted`. The replacement request opens a new inference span under the same `MODEL_STEP`, so its latency and chunks are no longer merged with the cancelled request.
