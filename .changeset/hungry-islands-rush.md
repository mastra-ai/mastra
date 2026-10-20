---
'@mastra/core': patch
---

Fixed slow provider listing in `mastra dev`. Opening the model picker in Studio (`GET /api/agents/providers`) no longer re-reads the shared provider cache from disk for every provider, so the request drops from seconds to well under a second.
