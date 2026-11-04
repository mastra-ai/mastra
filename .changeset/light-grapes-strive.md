---
'@mastra/libsql': patch
---

Fixed the Studio Traces page failing with `stored.trim is not a function` on LibSQL storage. Text columns whose value looks like JSON, such as the `{}` preview of a workflow run, now read back as the stored text instead of being parsed into an object. Fixes [#29355](https://github.com/mastra-ai/mastra/issues/29355).
