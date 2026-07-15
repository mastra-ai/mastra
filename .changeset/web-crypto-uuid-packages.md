---
'@mastra/agent-builder': patch
'@mastra/core': patch
'@mastra/deployer': patch
'@mastra/editor': patch
'@mastra/mcp': patch
'@mastra/memory': patch
'@mastra/rag': patch
'@mastra/server': patch
'mastra': patch
---

Switched UUID generation to the Web Crypto global (crypto.randomUUID) instead of importing randomUUID from node:crypto. No behavior change on Node.js; removes an unnecessary Node-only module dependency so packages bundle more cleanly for edge and V8-isolate runtimes such as the Convex default runtime and Cloudflare Workers.
