---
'@mastra/deployer': patch
---

Fixed platform-aware module resolution in bundleExternals. When targeting browser/worker platforms, the dependency optimization step now uses browser-compatible export conditions, ensuring packages like the Cloudflare SDK resolve to their web runtime.
