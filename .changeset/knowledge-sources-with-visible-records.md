---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added `listSourcesWithVisibleRecords` to Knowledge storage. It answers which of up to 1,000 sources own at least one live record visible in the given scopes, in a single query that applies the usual record visibility rules. Each source can carry its own extra scope (for example, a conversation thread's own scope) that applies to that source only. Use it to check many sources at once instead of listing records per source.
