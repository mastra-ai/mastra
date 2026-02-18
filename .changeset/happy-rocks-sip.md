---
'@mastra/deployer': patch
---

Fixed platform-aware module resolution when targeting browser/worker platforms. The dependency bundling step now uses browser-compatible export conditions, ensuring packages like the Cloudflare SDK resolve to their web runtime.
