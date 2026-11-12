---
'mastra': patch
---

Added `mastra api factory intake-candidate list`. It lists a Factory project's open issues and pull requests that have no card yet, newest first, as the server last read them. The optional JSON input filters by `kind` and `source` and pages with `limit` and `cursor`:

```bash
PROJECT_ID=your-project-id
mastra api factory intake-candidate list "$PROJECT_ID" '{"kind":"issue","source":"github","limit":10}'
```
