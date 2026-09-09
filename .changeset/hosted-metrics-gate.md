---
'mastra': patch
---

Fixed Studio's Metrics page showing "Metrics are not available with your current storage" for projects deployed on the Mastra platform. When Studio runs on the platform, observability reads are served by the hosted observability service, so metrics now work regardless of the project's configured storage. This also restores token and cost usage columns on the Traces page for platform deployments.
