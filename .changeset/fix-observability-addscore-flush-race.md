---
'@mastra/observability': patch
---

Fix silent drop of live scores/feedback annotations that race the async exporter flush. `Observability.addScore`/`addFeedback` now briefly retry the stored-trace lookup (up to ~900ms) before giving up, and log a warning when the annotation is still dropped because the target trace/span never reached storage.
