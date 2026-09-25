---
'@mastra/server': patch
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed feedback and scores submitted through the HTTP API (`POST /api/observability/feedback` and `POST /api/observability/scores`) never reaching observability exporters such as Mastra Platform or PostHog. They now take the same path as `mastra.observability.addFeedback()` and `addScore()`. Feedback or scores whose trace is not in local storage are no longer dropped.
