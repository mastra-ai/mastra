---
'@mastra/client-js': patch
'@mastra/core': patch
---

Preserve original tool-call arguments across client-tool streaming recursion. Tool results from recursive calls now carry the arguments the tool was invoked with, instead of being persisted as empty `{}`. Prevents long-running streaming agents from producing repeated invalid tool calls. Fixes #16017.
