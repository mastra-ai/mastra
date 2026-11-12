---
'@mastra/deployer': patch
---

Fixed `mastra dev` and `mastra build` failing under a loader such as tsx (for example `NODE_OPTIONS="--import tsx" mastra dev`) in projects whose `package.json` has no `"type": "module"`. When the Mastra config used a dynamic `import()`, the files generated from it were loaded as CommonJS and startup failed with `does not provide an export named ...`. Fixes [#28491](https://github.com/mastra-ai/mastra/issues/28491).

`mastra dev` and `mastra build` now log a warning when they cannot load the `bundler` options, instead of silently using the defaults.
