---
'mastra': minor
---

Added `mastra api factory project environment variables` commands to list, set, update and delete a Factory project's sandbox environment variables. Values are never returned.

```bash
mastra api factory project environment variables set <project-id> NPM_TOKEN '{"value":"<token>","appliesTo":"runtime"}'
```
