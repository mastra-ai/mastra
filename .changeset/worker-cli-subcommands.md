---
'mastra': minor
'@mastra/deployer': patch
---

Scope `mastra worker` as `build` / `start` / `dev` subcommands with its own bundle output, mirroring the server's `mastra build` / `mastra start` / `mastra dev` shape.

Previously `mastra worker [name]` both bundled and ran in one shot, writing to `.mastra/output/index.mjs` — clobbering the server bundle. Worker bundles now write to `.mastra/output/worker.mjs` so server and worker artifacts coexist.

**New surface:**

- `mastra worker build` — bundles a role-agnostic worker artifact to `.mastra/output/worker.mjs`.
- `mastra worker start [name]` — runs `worker.mjs`. `[name]` sets `MASTRA_WORKERS` for the spawned process so the same artifact can play any role.
- `mastra worker dev [name]` — build + start in one step (the closest equivalent of the old `mastra worker [name]`).

**Breaking change:** `mastra worker [name]` no longer works. Use `mastra worker dev [name]` for the same one-shot behavior, or split it into `mastra worker build` + `mastra worker start [name]` for production deployments.

**Deployer:** `Bundler._bundle` and `Bundler.getBundlerOptions` gained an optional `entryName` parameter (defaults to `'index'`) to control the rollup entry chunk filename. Existing callers (server `BuildBundler`, Vercel/Netlify/Cloudflare deployer subclasses) are unchanged.
