---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
'mastra': patch
---

Fixed the Studio review tab losing comments on reload. Comments on experiment results are now saved to the database like tags, in both the dataset review view and the agent review queue (https://github.com/mastra-ai/mastra/issues/19857).
