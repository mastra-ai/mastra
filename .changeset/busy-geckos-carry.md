---
'create-mastra': patch
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
---

Pin `@rollup/*` dependencies to fixed versions (instead of using `^`) to:

- Hotfix a bug inside `@rollup/plugin-commonjs`
- Have more control over the versions in the future to not have breakages over night
