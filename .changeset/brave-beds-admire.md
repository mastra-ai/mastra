---
'create-mastra': patch
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'@mastra/deployer-cloud': patch
'@mastra/core': patch
'mastra': patch
---

Replaced `@lukeed/uuid` with native `crypto.randomUUID()` to reduce bundle size and dependency count
