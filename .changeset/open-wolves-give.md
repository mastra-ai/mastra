---
'@mastra/server': patch
---

Starting an experiment with an unknown scorer id now returns a 400 error instead of creating an experiment that fails later.
