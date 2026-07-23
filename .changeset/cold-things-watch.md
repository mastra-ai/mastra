---
'@mastra/observability': patch
---

Fixed logs and metrics emitted outside of a span (for example server request logs) being stored without an environment or service name. They now inherit the Mastra-level environment (from the environment config option or NODE_ENV) and the configured service name, so filtering by environment in Studio Observability no longer hides these logs and metrics. Relates to https://github.com/mastra-ai/mastra/issues/19870
