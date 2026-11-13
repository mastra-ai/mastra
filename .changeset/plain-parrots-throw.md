---
'@mastra/core': patch
---

Client-executed tools with `toModelOutput` now send the mapped output to the model after memory recall, instead of the raw tool result. Fixes #25744.

The server now discards `mastra.modelOutput` values a client sends on client-tool results and, when the tool defines `toModelOutput`, computes the mapping itself.
