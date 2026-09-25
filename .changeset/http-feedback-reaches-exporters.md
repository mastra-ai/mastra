---
'@mastra/server': patch
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed feedback and scores submitted through the HTTP API (`POST /api/observability/feedback` and `POST /api/observability/scores`) never reaching observability exporters such as Mastra Platform or PostHog. Configured exporters now receive them, including when the trace is not in local storage.
