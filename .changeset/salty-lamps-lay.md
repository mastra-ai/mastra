---
'@mastra/core': patch
---

Fixed tool search so complete tool names in a query rank before keyword matches, including names with hyphens and underscores. Repeated query words no longer skew tool search results. Fixes [#28113](https://github.com/mastra-ai/mastra/issues/28113).
