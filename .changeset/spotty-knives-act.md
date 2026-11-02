---
'@mastra/evals': minor
'@mastra/cloudflare-sandbox': patch
'@mastra/apple-container': patch
'@mastra/langsmith': patch
'@mastra/google-drive': patch
'@mastra/nestjs': patch
'@mastra/azure-ai-search': patch
'@mastra/e2b-desktop': patch
'@mastra/cloudflare-d1': patch
'@mastra/agentcore': patch
'@mastra/turbopuffer': patch
'@mastra/agentfs': patch
'@mastra/daytona': patch
'@mastra/railway': patch
'@mastra/sprites': patch
'@mastra/telegram': patch
'@mastra/cloudflare': patch
'@mastra/blaxel': patch
'@mastra/vercel': patch
'@mastra/discord': patch
'@mastra/s3vectors': patch
'@mastra/vectorize': patch
'@mastra/azure': patch
'@mastra/modal': patch
'@mastra/pinecone': patch
'@mastra/slack': patch
'@mastra/teams': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/e2b': patch
'@mastra/gcs': patch
'@mastra/convex': patch
'@mastra/valkey': patch
'@mastra/s3': patch
'@mastra/rag': patch
'@mastra/redis': patch
---

Updated `@mastra/evals/vitest` to support Vitest 5. The custom matchers (`toHaveVerdict`, `toHaveScoreAbove`, `toHaveScoreBelow`, `toPassGates`, `toPassThresholds`) are now typed for Vitest 5's `expect` API, so they show up correctly in type checking.

**Requires Vitest 5.** The `vitest` peer dependency is now `>=5.0.0 <6.0.0`. Vitest 5 changed its matcher typings in a way that cannot be shared with Vitest 3 or 4, so projects on older Vitest versions should stay on the previous `@mastra/evals` release or upgrade Vitest:

```bash
npm install -D vitest@^5
```
