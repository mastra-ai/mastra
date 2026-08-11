---
'@mastra/deployer-cloudflare': patch
---

Fixed the generated Cloudflare Worker entry rebuilding the Mastra application on every request. Warm requests now reuse the initialized application, so storage initialization and other per-instance caches behave as expected. If startup fails, the next request retries it.
