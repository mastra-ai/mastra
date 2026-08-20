---
'@mastra/deployer': minor
---

Improved generated server shutdown to drain in-flight HTTP requests before closing Mastra resources ([#20678](https://github.com/mastra-ai/mastra/issues/20678)). Refresh streams now close during shutdown, drain failures no longer skip resource cleanup, and a second shutdown signal exits immediately.
