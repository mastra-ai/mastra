---
'@mastra/core': patch
---

Client-executed tools with `toModelOutput` now send the mapped output to the model after memory recall, instead of the raw tool result. Fixes #25744.

The server now discards `mastra.modelOutput` values a client sends on client-tool results and, when the tool defines `toModelOutput`, computes the mapping itself. A `mastra.modelOutput` value already stored in memory on a client tool without `toModelOutput` is no longer sent to the model.

Tool results whose `mastra.modelOutput` the server computed now also carry `mastra.modelOutputOrigin: 'server'` in their provider metadata. Mastra trusts stored mappings by this marker and removes it from client input, so a server tool's mapping survives memory recall even when the request also declares a client tool with the same name.
