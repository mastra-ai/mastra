---
'@mastra/playground-ui': patch
'@mastra/core': patch
---

Fix VNext generate/stream usage tokens. They used to be undefined, now we are receiving the proper values.
