---
'@mastra/deployer': patch
---

The generated server now passes `server.drainTimeout` to `mastra.shutdown()` so in-flight workflow runs get the same window to finish as HTTP requests, and the core shutdown deadline is extended by that window. Related to https://github.com/mastra-ai/mastra/issues/22863
