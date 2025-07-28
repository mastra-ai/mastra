---
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-vercel': patch
'mastra': patch
'@mastra/deployer': patch
---

Extract tools import from `createHonoServer`; the function now receives tools via a prop on the `options` parameter.
