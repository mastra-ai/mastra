---
'@mastra/core': patch
---

UUID generation now uses the Web Crypto global (crypto.randomUUID) instead of importing randomUUID from node:crypto. No behavior change on Node.js; removes an unnecessary Node-only module dependency so @mastra/core bundles more cleanly for edge and V8-isolate runtimes such as the Convex default runtime and Cloudflare Workers.
