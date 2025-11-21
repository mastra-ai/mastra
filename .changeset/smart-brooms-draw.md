---
'@mastra/deployer': patch
---

Allow for `bundler.externals: true` to be set.

With this configuration during `mastra build` all dependencies (except workspace dependencies) will be treated as "external" and not bundled. Instead they will be added to the `.mastra/output/package.json` file.
