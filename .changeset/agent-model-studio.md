---
'mastra': patch
---

Added a model picker to the Advanced section of the Studio run-experiment dialog. For agent targets, pick a provider and model to run the experiment on instead of the agent's own model; leave it empty, or reset it, to keep the agent's model. The default run name includes the picked model, so runs on different models are easy to tell apart. The picker is shown as locked when an admin model policy hides model selection.
