---
'@mastra/deployer': patch
---

Fixes `mastra build` failing with `BABEL_TRANSFORM_ERROR` when using spread operator in Mastra config. The Babel plugins now correctly skip `SpreadElement` nodes when searching for config properties.

