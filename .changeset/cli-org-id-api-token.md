---
'mastra': patch
---

Use `MASTRA_ORG_ID` directly when resolving the current organization, so `mastra env` and `mastra db` work with `MASTRA_API_TOKEN` even when the token cannot list organizations.
