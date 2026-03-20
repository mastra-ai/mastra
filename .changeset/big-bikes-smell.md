---
'@mastra/memory': minor
'@mastra/core': patch
---

Added experimental retrieval-mode recall tooling for observational memory.

When `observationalMemory.retrieval` is enabled with `scope: 'thread'`, observation groups store colon-delimited message ranges (`startId:endId`) pointing back to the raw messages they were derived from. A `recall` tool is registered that lets agents retrieve those source messages via cursor-based pagination.

The recall tool supports:
- **Detail levels**: `detail: 'low'` (default) returns truncated text with part indices; `detail: 'high'` returns full content clamped to one part per call with continuation hints
- **Part-level fetch**: `partIndex` targets a single message part at full detail
- **Pagination flags**: `hasNextPage` and `hasPrevPage` in results
- **Token limiting**: results are capped at a token budget with `truncated` and `tokenOffset` reporting
- **Smart range detection**: passing a range as a cursor returns a helpful hint explaining how to extract individual IDs
