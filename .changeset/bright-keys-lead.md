---
'@mastra/deployer': patch
'mastra': patch
---

Added gzip compression to studio static file serving. The deployer Hono server and CLI dev server now compress responses, reducing download sizes by ~70% (e.g. 5.6MB → ~1.7MB for the main bundle).
