---
'@mastra/observability': patch
---

Fix feedback and score delivery so each exporter handles its own destination. Missing local traces no longer prevent remote export, and storage lookup retries are included in flush and shutdown.
