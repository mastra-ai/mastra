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

Replaced `fs-extra`, `strip-json-comments`, and `tinyglobby` with native Node.js equivalents (`node:fs/promises`, `typescript`, `node:fs/promises` glob) to reduce bundle size and dependency count
