---
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Added a comment column to experiment results so review comments persist. The column is added automatically and non-destructively on startup for existing databases (https://github.com/mastra-ai/mastra/issues/19857).
