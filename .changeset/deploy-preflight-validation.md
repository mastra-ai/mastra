---
'mastra': patch
---

Add pre-deploy validation (preflight) to `mastra studio deploy` and `mastra server deploy` that inspects the built bundle before upload and surfaces likely deployment failures locally.

**What it checks**

- **Missing env vars** (warning) — `process.env.FOO` references in the bundle that aren't satisfied by the resolved `.env`/`.env.local` (or `--env-file`). Common platform/runtime/tooling vars (`PORT`, `NODE_ENV`, `MASTRA_*`, `OTEL_*`, `DEBUG`, etc.) are allowlisted.
- **Local storage paths** (error) — SQLite/file URLs (`file:./mastra.db`, `sqlite://...`) and `localhost`/`127.0.0.1` connection strings that won't survive on a remote container.

**How it runs**

- Runs after the local build (or after `--skip-build` when `.mastra/output/index.mjs` already exists), before zipping/uploading.
- Errors always block the deploy and exit non-zero (so CI surfaces them as a real failure). Warnings prompt for confirmation in interactive mode and pass through silently in `--yes` / headless mode; declining the prompt cancels with exit code 0.
- Opt out entirely with `--skip-preflight` or `MASTRA_SKIP_PREFLIGHT=1`.
