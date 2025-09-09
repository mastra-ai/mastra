---
'@mastra/core': patch
---

Fix issue with response message id consistency between stream/generate response and the message ids saveed in the DB. Also fixed the custom generatorId implementation to work with this.
