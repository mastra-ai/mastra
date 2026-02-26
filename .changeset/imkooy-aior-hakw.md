---
'@mastra/core': patch
---

Fixed an issue where custom `data-*` chunks written in a tool's `execute` function (via `writer.custom()`) bypassed output processors entirely. These chunks now pass through output processors just like `tool-result` and other chunk types.
