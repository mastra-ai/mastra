---
'@mastra/playground-ui': patch
---

Fixed shared component edits resetting React state in Studio and Factory during development. Watch builds now keep stable chunk names so hot reload swaps the module in place instead of remounting it.
