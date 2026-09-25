---
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/core': patch
---

Fixed feedback and scores created through the HTTP API (`POST /api/observability/feedback` and `POST /api/observability/scores`) never reaching observability exporters. The server now publishes them through the observability event bus, so Mastra Platform, PostHog, and other exporters receive them exactly like `mastra.observability.addFeedback()` and `addScore()` calls do. Runtimes without a configured observability instance keep writing straight to storage.
