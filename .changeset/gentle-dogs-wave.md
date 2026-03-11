---
'@mastra/core': patch
'@mastra/playground-ui': patch
'@mastra/playground': patch
---

Added permission denied handling for dataset pages. Datasets now show a "Permission Denied" screen when the user lacks access, matching the behavior of agents, workflows, and other resources.
