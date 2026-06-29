---
'@mastra/core': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Fixed buffered observation extraction metadata so stored OM chunks keep extracted values and extraction failures across memory storage adapters.
