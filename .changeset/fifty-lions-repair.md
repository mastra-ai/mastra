---
'mastra-factory': patch
---

Hardened the scaffolding flow based on review feedback:

- The dev UI port is now strict: if 5173 is taken, `npm run dev` fails with instructions to set `MASTRACODE_UI_PORT` and `MASTRACODE_PUBLIC_URL` together instead of silently moving to a port where OAuth callbacks (WorkOS/GitHub/Linear) would break.
- Cancelling the GitHub App form midway no longer saves partially entered credentials — the env stays untouched until every field is provided.
- `--llm-api-key` without `--llm` is now rejected instead of silently ignored.
- Invalid `--db-url` errors no longer echo the full URL (it may contain credentials).
- The generated template now uses caret ranges for Mastra packages and is synced to the template repository automatically from the monorepo, matching the process used by all other templates.
