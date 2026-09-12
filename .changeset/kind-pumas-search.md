---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Fixed Knowledge search to keep inaccessible records absent and continue through bounded storage pages until authorized matches are found.
