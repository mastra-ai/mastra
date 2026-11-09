---
'@mastra/core': patch
---

Client-executed tools with `toModelOutput` now send the mapped output to the model after memory recall, instead of the raw tool result. Fixes #25744.

The server now discards `mastra.modelOutput` values a client sends on tool results and computes the mapping itself, so a client can no longer substitute its own mapped output for the server's.
