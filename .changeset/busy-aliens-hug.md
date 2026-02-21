---
'@mastra/core': patch
---

Fixed duplicate Vercel AI Gateway configuration that could cause incorrect API key resolution. Removed a redundant override that conflicted with the upstream models.dev registry.
