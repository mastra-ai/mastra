---
'@mastra/oracledb': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Fixed buffered reflections activating a buffer that another process extended at the same moment. Activation now applies only the buffered reflection it read; an extended buffer stays in place and activates on the next turn, so values extracted for the earlier buffer are never published with it. Fixes [#27262](https://github.com/mastra-ai/mastra/issues/27262).
