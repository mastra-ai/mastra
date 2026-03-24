---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/server': patch
---

Added storage type detection to the Metrics Dashboard. The dashboard now shows an empty state when the observability storage does not support metrics (e.g. PostgreSQL, LibSQL), and displays a warning when using in-memory storage since metrics are not persisted across server restarts. Also added a docs link button to the Metrics page header.
