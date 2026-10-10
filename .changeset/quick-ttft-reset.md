---
'@mastra/observability': patch
---

Fixed time to first token on model inference spans. Each inference span now records when its own request produced its first content, instead of reusing the time from the run's first request. This was most visible when a signal interrupted a request and the replacement reported a first-token time from before it started.
