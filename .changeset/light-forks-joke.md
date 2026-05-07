---
'@mastra/core': patch
---

Fixed an issue where trajectory and step scorer results from `runEvals` were not saved to storage. These scores now persist correctly and appear alongside agent and workflow scores in Studio's observability section.
