---
'mastra': minor
---

Added `mastra env vars pull [environment]` to download the full set of env vars an environment actually deploys with — vars stored on the environment (for example, added in the dashboard's environment editor) merged with project-level vars. Managed vars from attached databases are listed as comments (names only) since their values are platform-managed secrets.

```bash
mastra env vars pull staging --output .env.staging
```

Previously the only pull command, `mastra server env pull`, silently read project-level vars only, so vars added through the dashboard were missing from the pulled file. That command now prints a note about its scope and points to `mastra env vars pull`.
