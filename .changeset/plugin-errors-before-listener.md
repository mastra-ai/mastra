---
'@mastra/code-sdk': patch
---

**Held plugin errors until someone listens.** `PluginManager.onPluginError` now receives errors reported before it subscribed, such as a plugin signal provider failing to start while Mastra Code boots. They still go to `console.warn` when reported, the first listener gets the 20 most recent, and later listeners only see new ones.
