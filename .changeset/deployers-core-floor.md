---
'@mastra/deployer': patch
'mastra': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-sandbox': patch
'@mastra/deployer-vercel': patch
'@mastra/temporal': patch
---

Raised the `@mastra/core` peer dependency floor to 1.83.0. These packages depend on `@mastra/server` (directly or through `@mastra/deployer`), which now requires `@mastra/core` 1.83.0 or later. Upgrade `@mastra/core` together with these packages.
