---
'@mastra/datadog': patch
---

Fixed missing peer dependency warnings for `@openfeature/core` and `@openfeature/server-sdk`

Added `@openfeature/core` and `@openfeature/server-sdk` as optional peer dependencies to resolve warnings that occur during installation. These are transitive dependencies from `dd-trace` and are now properly declared.

**Troubleshooting documentation added:**

- Native module ABI mismatch errors (Node.js version compatibility with `dd-trace`)
- Bundler externals configuration for `dd-trace` and native modules
