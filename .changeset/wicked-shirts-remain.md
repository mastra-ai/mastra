---
'@mastra/deployer-cloudflare': patch
---

Fixed agent streaming in Cloudflare Workers by updating the default compatibility date to enable WeakRef and FinalizationRegistry. Fixes [#27899](https://github.com/mastra-ai/mastra/issues/27899).
