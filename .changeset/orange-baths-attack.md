---
'@mastra/core': patch
---

Fixed workspace search being wiped when skills refresh. Previously, calling `skills.refresh()` or triggering a skills re-discovery via `maybeRefresh()` would clear the entire BM25 search index, including auto-indexed workspace content. Now only skill entries are removed from the index during refresh, preserving workspace search results.
