---
'@mastra/deployer': patch
'mastra': patch
---

Fix `bundler.transpilePackages` being silently ignored by `mastra build` and `mastra dev`. The option is now threaded through `BundlerOptions`, `analyzeBundle`, and `DevBundler.watch` so non-workspace npm packages that ship TypeScript source can be transpiled as documented.
