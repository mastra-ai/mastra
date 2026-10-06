---
'@mastra/factory': patch
'@mastra/memory': patch
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/turso': patch
'@mastra/pg': patch
---

Fixed Subconscious reminder reads to honor configured Knowledge access controls and fail closed instead of falling back to raw storage.
