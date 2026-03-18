---
'@mastra/memory': minor
'@mastra/core': patch
---

Added graph-mode recall tooling for observational memory.

When `observationalMemory.graph` is enabled with `scope: 'thread'`, observation groups now store colon-delimited message ranges (`startId:endId`) pointing back to the raw messages they were derived from. A new `recall` tool is registered that lets agents retrieve those source messages via cursor-based pagination.

The recall tool accepts a single message ID as the cursor (extracted from a range) plus optional page/limit parameters. When a range is passed directly as a cursor, the tool returns a helpful hint explaining how to extract the individual IDs.
