---
'@mastra/factory': patch
---

Fixed Slack sessions using observational-memory models from an incompatible provider. New and restarted sessions now use a memory model compatible with their running model, including after a model switch fails.
