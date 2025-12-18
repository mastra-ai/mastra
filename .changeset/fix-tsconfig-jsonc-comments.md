---
'@mastra/deployer': patch
---

The `hasPaths()` function now uses `strip-json-comments` to properly parse tsconfig.json files that contain comments. Previously, `JSON.parse()` would fail silently on JSONC comments, causing path aliases like `@src/*` to be incorrectly treated as npm scoped packages.
