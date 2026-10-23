---
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
---

Added a model picker to the Advanced section of the Studio run-experiment dialog. For agent targets you can pick a provider and model to run the experiment on instead of the agent's own model; leave it empty, or reset it, to keep the agent's model. The picker is shown as locked when an admin model policy hides model selection.
