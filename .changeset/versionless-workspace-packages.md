---
'@mastra/deployer': patch
---

Fixed `mastra dev` failing with "Missing subpath specifier" when the app depends on a private workspace package that has no `version` in its `package.json`. Fixes #26321.
