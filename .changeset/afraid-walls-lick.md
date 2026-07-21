---
'@mastra/core': patch
---

Fixed review comments on experiment results not being saved. Comments written in the Studio review tab were lost on reload because there was no comment column on experiment results. Experiment results now have a persisted comment field, and updateExperimentResult accepts a comment alongside status and tags. Fixes https://github.com/mastra-ai/mastra/issues/19857
