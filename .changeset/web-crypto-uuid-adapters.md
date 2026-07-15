---
'@mastra/acp': patch
'@mastra/claude': patch
'@mastra/cloudflare': patch
'@mastra/cloudflare-d1': patch
'@mastra/code-sdk': patch
'@mastra/couchbase': patch
'@mastra/cursor': patch
'@mastra/github-signals': patch
'@mastra/inngest': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/nestjs': patch
'@mastra/observability': patch
'@mastra/openai': patch
'@mastra/pg': patch
'@mastra/google-cloud-pubsub': patch
'@mastra/redis-streams': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/vectorize': patch
'@mastra/voice-aws-nova-sonic': patch
'@mastra/voice-google-gemini-live': patch
'mastracode': patch
---

Switched UUID generation to the Web Crypto global (crypto.randomUUID) instead of importing randomUUID from node:crypto. No behavior change on Node.js; removes an unnecessary Node-only module dependency so packages bundle more cleanly for edge and V8-isolate runtimes such as the Convex default runtime and Cloudflare Workers.
