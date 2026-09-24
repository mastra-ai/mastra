# Verification

Run commands from `workflows/render/` after the package-local install described in the README. Keep caches, test data and logs under `.scratch/`.

## Automated contracts

```sh
npm run typecheck --workspaces=false
npm test --workspaces=false
npm run build --workspaces=false
```

Tests exercise graph behavior, strict JSON transport, state/context restrictions, unsupported capabilities, caller/worker version mismatch, native context isolation, durable binding races, ambiguous submission, cancellation versus completion, and event-stream fallback. `src/inference.type-test.ts` uses ordinary TypeScript compilation with expected errors to verify schema inference and the restricted context surface. It is excluded from emitted package files.

## Real Render CLI and PostgreSQL

Use a disposable PostgreSQL database and supply its connection string. The fixture creates provider and Mastra tables. It also writes process/retry observations to `.scratch/audit/`; this filesystem audit is test instrumentation and is not an application persistence mechanism.

In one terminal:

```sh
export DATABASE_URL='postgres://user:password@127.0.0.1:5432/render_test'
export RENDER_USE_LOCAL_DEV=true
export RENDER_LOCAL_DEV_URL=http://127.0.0.1:8138
render workflows dev --port 8138 -- node node_modules/tsx/dist/cli.mjs scripts/fixture-worker.ts
```

With the same environment, in another terminal:

```sh
node node_modules/tsx/dist/cli.mjs scripts/local-smoke.ts
node node_modules/tsx/dist/cli.mjs scripts/lifecycle-smoke.ts
node node_modules/tsx/dist/cli.mjs scripts/postgres-smoke.ts
```

The first check runs successful, retry-once and permanently failing graphs. It verifies separate processes, parallel overlap, state/context/getter transport, native grandchildren and the absence of successful-sibling replay. The second uses separate short-lived backend clients to reconnect, cancel a running root, and kill a test-owned root process. It checks provider and framework snapshot status. It kills only a PID recorded by that test's own worker callback.

The PostgreSQL check uses two independent pools to verify unique creation, competing updates, stale revision rejection and terminal stability. The local CLI currently ignores the root-ID list filter, so the fixture additionally filters returned rows by root ID before asserting task lineage.

Evidence is written to `.scratch/local-observations.json` and `.scratch/lifecycle-observations.json`. Render's local dev server is in-memory; keep it running between lifecycle calls. Stop the owned server and disposable database when done.

## Packaged consumer and application example

Build and pack the provider, then install the archive in `examples/editorial-review` as described by its README. This consumes the package's actual exports/declarations, without TypeScript aliases to source or monorepo linking. Run the example's typecheck and start its own Render local dev worker on port 8139.

With the example worker running and `DATABASE_URL`, `RENDER_USE_LOCAL_DEV=true`, `RENDER_LOCAL_DEV_URL=http://127.0.0.1:8139`, `RENDER_WORKFLOW_SLUG=editorial-local`, and `APP_BUILD_ID=editorial-demo-v1` set:

```sh
node node_modules/tsx/dist/cli.mjs scripts/example-smoke.ts
```

The HTTP check starts and restarts an example backend on port 4318. It verifies unauthorized requests, invalid input, owner isolation for lookup/cancellation, an asynchronous accepted response, backend restart and successful reconnection, explicit failure, and real cancellation. It closes the backend processes it owns. Results are recorded in `.scratch/example-observations.json`. The example makes no model calls in deterministic mode.

Hosted Render, production deploy transitions, paid model behavior, Studio streaming and unpublished Mastra core compatibility remain unverified.
