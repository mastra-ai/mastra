---
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-sandbox': patch
'@mastra/deployer-vercel': patch
'@mastra/deployer-cloud': patch
'mastra': patch
'@mastra/temporal': patch
---

Fixed the minimum `@mastra/core` peer dependency to `>=1.81.0-0 <2.0.0-0`. Upgrade core alongside the CLI and deployer packages so `new Mastra({ deployer })` uses the interface-based deployer contract.
