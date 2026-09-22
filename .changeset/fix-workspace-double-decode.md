---
'@mastra/server': patch
---

Fix workspace filesystem routes double-decoding the request path. Framework adapters already deliver decoded query and path-param values, so the handlers' extra `decodeURIComponent` call misresolved any filename containing `%` followed by two hex digits (e.g. `a%20b.txt` resolved to `a b.txt`). This could read, write, or create the wrong file, and delete could remove a different file than requested. Removed all redundant decoding across the workspace fs read/write/list/delete/mkdir/stat and skill routes (and the agent skill route), and corrected the misleading "(URL encoded)" schema descriptions. Closes #24620.
