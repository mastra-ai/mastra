---
'@mastra/deployer': patch
---

Fix `ERR_INVALID_ARG_VALUE` during bundling when a bare import is resolved from a Rollup virtual module. `nodeModulesExtensionResolver` now skips NUL-prefixed importers (e.g. `\0virtual:#entry`) instead of treating them as filesystem paths.
