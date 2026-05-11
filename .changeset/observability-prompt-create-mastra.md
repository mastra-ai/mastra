---
'mastra': minor
'create-mastra': minor
---

Add "Enable Mastra Observability?" prompt to `create-mastra` and `mastra init`.

When the user opts in, the CLI runs the interactive browser login flow (if not already authenticated), lets them pick an existing project or create a new one, mints a fresh organization access token, and writes `MASTRA_CLOUD_ACCESS_TOKEN` + `MASTRA_PROJECT_ID` to `.env`. The generated project already registers a `MastraPlatformExporter`, so no additional setup is needed to start sending traces.

If provisioning fails (e.g., the platform is unreachable), the command falls back to writing placeholder env vars with instructions.

Both commands also accept `--observability` / `--no-observability` flags for non-interactive use.
