---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Knowledge reads filtered by caller scope (node lists, search, activity, thread records) now use indexed scope keys instead of scanning every row's scope JSON, so they stay fast as Knowledge grows. Resolving a wikilink or node name also uses an index on the node name instead of scanning every node. The new indexes are created automatically on the next Knowledge initialization.
