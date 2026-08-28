---
'@mastra/deployer': patch
---

Fix `mastra build` under `bundler: { externals: true }` emitting a transitive workspace subpath import (e.g. `@scope/b/feature` imported by another workspace package) as an unresolved bare specifier. Such imports now resolve through the workspace package's `exports` map and compile inline, so the output no longer fails at runtime with `ERR_MODULE_NOT_FOUND` or `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`.
