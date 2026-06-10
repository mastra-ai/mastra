---
'@mastra/deployer': patch
'@mastra/server': patch
---

hono is now a peer dependency of @mastra/server, eliminating TypeScript type conflicts when the host project uses a different hono version
