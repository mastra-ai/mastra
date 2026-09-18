---
'mastra': patch
---

Added advanced trace-query delta fields to API command metadata and preserved polling cursors in numbered-page output.

```bash
mastra api trace query '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"pagination":{"page":0,"perPage":100}}'
mastra api trace query '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"mode":"delta","after":"CURSOR_FROM_NUMBERED_RESPONSE","limit":100}'
```

Preserve `data.deltaCursor` from the first response and use it as `CURSOR_FROM_NUMBERED_RESPONSE` in the second request. If the cursor is unavailable, delta polling isn't supported by the installed server and storage combination.
