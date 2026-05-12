---
'mastra': patch
---

`mastra studio deploy` and `mastra server deploy` now read `MASTRA_PROJECT_ID` and `MASTRA_ORG_ID` from the project's `.env` file, so projects scaffolded with Mastra Observability auto-link to the existing platform project on first deploy instead of creating a new one. Existing `process.env` values still take precedence.
