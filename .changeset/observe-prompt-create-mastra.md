---
'mastra': minor
'create-mastra': minor
---

Add "Enable Mastra Observe?" prompt to `create-mastra` and `mastra init`.

When the user opts in, the CLI runs the interactive browser login flow (if not already authenticated), lets them pick an existing Observe project or create a new one, mints a fresh ingest key, and writes `MASTRA_CLOUD_ACCESS_TOKEN` + `MASTRA_CLOUD_TRACES_ENDPOINT` to `.env`. The generated project already registers a `CloudExporter`, so no additional setup is needed to start sending traces.

If provisioning fails (e.g., the platform is unreachable), the command falls back to writing placeholder env vars with instructions.

Both commands also accept `--observe` / `--no-observe` flags for non-interactive use.
