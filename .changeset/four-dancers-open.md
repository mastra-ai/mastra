---
'@mastra/core': patch
---

Removed the last node:crypto randomUUID imports from @mastra/core, switching to the Web Crypto global. This keeps agent, workflow, and core modules bundleable for edge/isolate runtimes (Cloudflare Workers, Convex) that provide Web Crypto but not Node builtins.
