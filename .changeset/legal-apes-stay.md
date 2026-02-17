---
'mastra': patch
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-vercel': patch
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-cloud': patch
---

Fixed CMS features (Create an agent button, clone, edit, create scorer) not appearing in built output. The build command now writes package metadata so the studio can detect installed Mastra packages at runtime.
