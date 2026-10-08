---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Improved Knowledge read and link-resolution speed on large stores. Listing nodes, searching, reading activity, and reading a thread's records now stay fast as Knowledge grows, instead of slowing down with every row. Resolving a `[[wikilink]]` or node name no longer scans every node. The new indexes are created automatically the next time Knowledge initializes; no migration step is needed.
