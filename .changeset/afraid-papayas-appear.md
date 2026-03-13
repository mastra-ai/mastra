---
'@mastra/schema-compat': patch
---

Fixed "Dynamic require of zod/v4 is not supported" error when schema-compat is consumed by ESM bundles (e.g. via npx mastracode). The dynamic require fallback was incorrectly selecting esbuild's require shim instead of Node.js createRequire.
