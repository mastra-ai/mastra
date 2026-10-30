---
'@mastra/playground-ui': patch
---

Added page and note payload types plus pure page-tree and page-graph models for the Knowledge explorer, ahead of the page tree view. Siblings sort by position in code-unit order, pages whose parent isn't loaded stay visible as roots, and graph edges combine parent links with resolved mentions.
