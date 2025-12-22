---
'@mastra/deployer': patch
---

Fixes `mastra build` failing with `BABEL_TRANSFORM_ERROR` when using spread operator in Mastra config. The Babel plugins now correctly skip `SpreadElement` nodes when searching for config properties.

Also fixes npm package aliases (like `"ai-v5": "npm:ai@5.0.93"`) not being resolved correctly when writing the output package.json - now uses the actual package name from the resolved package.json instead of the alias.

