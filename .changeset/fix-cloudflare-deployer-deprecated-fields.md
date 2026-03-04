---
'@mastra/deployer-cloudflare': patch
---

Fix deprecated config fields (projectName, workerNamespace, d1Databases, kvNamespaces) leaking into wrangler.json. Add execa stub alias for Cloudflare Workers compatibility.
