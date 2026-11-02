---
'@mastra/code-sdk': patch
---

Fixed missing traces and logs for Factory deployments on Mastra Platform. When Mastra Code has nowhere to send telemetry, it now leaves observability to the deployment, so the platform's exporter keeps working.
