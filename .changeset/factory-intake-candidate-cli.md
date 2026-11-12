---
'mastra': patch
---

Added `mastra api factory intake-candidate list`. It lists a Factory project's open issues and pull requests that have no card yet, newest first, as the server last read them. The optional JSON input filters by `source`, `kind` and `label`, and pages with `limit` and `cursor`. A source is an integration, or an integration with the kind of record wanted from it:

```bash
PROJECT_ID=your-project-id
mastra api factory intake-candidate list "$PROJECT_ID" '{"source":["github:issue","linear"],"limit":10}'
```
