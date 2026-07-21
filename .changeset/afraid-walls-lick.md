---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Fixed review comments on experiment results not being saved. Comments written in the Studio review tab were lost on reload because there was no comment column on experiment results. Experiment results now have a persisted comment field, and updateExperimentResult accepts a comment alongside status and tags. Fixes https://github.com/mastra-ai/mastra/issues/19857
