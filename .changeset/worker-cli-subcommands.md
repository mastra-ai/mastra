---
'mastra': minor
---

Scope `mastra worker` as `build` / `start` / `dev` subcommands, mirroring the server's `mastra build` / `mastra start` / `mastra dev` shape.

Previously `mastra worker [name]` both bundled and ran in one shot. Splitting it into discrete `build` and `start` steps makes the worker lifecycle match the server lifecycle: bundle once on CI, ship the artifact, then start it (with `[name]` setting `MASTRA_WORKERS`) on the target host.

**New surface:**

- `mastra worker build` — bundles a role-agnostic worker artifact.
- `mastra worker start [name]` — runs the built worker. `[name]` sets `MASTRA_WORKERS` for the spawned process.
- `mastra worker dev [name]` — build + start in one step (the closest equivalent of the old `mastra worker [name]`).

**Output location:** by default the worker bundle writes to `.mastra/output/index.mjs`, the same path as `mastra build`. In a split deployment (one host runs the server, another runs the worker) that's what you want — each host bundles only the role it ships. Running both `mastra build` and `mastra worker build` back-to-back in the same project will overwrite, by design.

If you want both bundles to coexist on disk in the same project, pass `--output-dir <path>` to `mastra worker build` to redirect the worker bundle anywhere — relative or absolute. When a custom path is given, `prepare` wipes only that target so adjacent build artifacts (including `.mastra/output/`) are left alone:

```sh
mastra build                                      # writes .mastra/output/index.mjs (server)
mastra worker build --output-dir dist/worker      # writes dist/worker/index.mjs
mastra worker start --dir dist/worker             # runs the worker bundle from there
```

**Breaking change:** `mastra worker [name]` no longer works. Use `mastra worker dev [name]` for the same one-shot behavior, or split it into `mastra worker build` + `mastra worker start [name]` for production deployments.
