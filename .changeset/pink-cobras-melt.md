---
'@mastra/deployer': minor
'@mastra/deployer-cloudflare': minor
'@mastra/deployer-cloud': minor
'@mastra/core': patch
'mastra': patch
---

Set `externals: true` as the default for `mastra build` and cloud-deployer to reduce bundle issues with native dependencies.

**Note:** If you previously relied on the default bundling behavior (all dependencies bundled), you can explicitly set `externals: false` in your bundler configuration.