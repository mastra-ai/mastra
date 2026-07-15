---
'@mastra/voice-google-gemini-live': patch
'@mastra/google-cloud-pubsub': patch
'@mastra/agent-builder': patch
'@mastra/nestjs': patch
'@mastra/observability': patch
'@mastra/redis-streams': patch
'@mastra/cloudflare-d1': patch
'@mastra/voice-aws-nova-sonic': patch
'@mastra/claude': patch
'@mastra/cursor': patch
'@mastra/openai': patch
'@mastra/deployer': patch
'@mastra/cloudflare': patch
'@mastra/inngest': patch
'@mastra/couchbase': patch
'@mastra/vectorize': patch
'@mastra/editor': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/acp': patch
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/github-signals': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/rag': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/pg': patch
---

Switched UUID generation to the Web Crypto global (crypto.randomUUID) instead of importing randomUUID from node:crypto. No behavior change on Node.js; removes an unnecessary Node-only module dependency so packages bundle more cleanly for edge and V8-isolate runtimes such as the Convex default runtime and Cloudflare Workers.
