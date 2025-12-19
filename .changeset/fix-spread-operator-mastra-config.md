---
"@mastra/deployer": patch
---

Fix spread operator support in Mastra config. Previously, using `new Mastra({ ...config })` would cause a `BABEL_TRANSFORM_ERROR` during build because the Babel plugins didn't handle `SpreadElement` nodes in the config object.
