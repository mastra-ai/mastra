---
'@mastra/deployer-vercel': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-cloudflare': patch
---

Servers built with the Vercel, Netlify, and Cloudflare deployers now report model token usage telemetry after each request that calls a model, matching what long-running servers already report. The project is identified by a hash of `VERCEL_PROJECT_ID` on Vercel, `SITE_ID` on Netlify, or the Git `origin` read at build time on Cloudflare; raw values are never sent. Set `MASTRA_TELEMETRY_DISABLED=1` on the deployment to opt out.
