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
node node_modules/tsx/dist/cli.mjs scripts/loop-smoke.ts
node node_modules/tsx/dist/cli.mjs scripts/lifecycle-smoke.ts
node node_modules/tsx/dist/cli.mjs scripts/postgres-smoke.ts
```

The first check runs successful, retry-once and permanently failing graphs. It verifies separate processes, parallel overlap, state/context/getter transport, native grandchildren and the absence of successful-sibling replay. The lifecycle check uses separate short-lived backend clients to reconnect, cancel a running root, and kill a test-owned root process. It checks provider and framework snapshot status. It kills only a PID recorded by that test's own worker callback.

The PostgreSQL check uses two independent pools to verify unique creation, competing updates, stale revision rejection and terminal stability. The local CLI currently ignores the root-ID list filter, so the fixture additionally filters returned rows by root ID before asserting task lineage.

The loop check exercises both loop operators across separate task processes, verifies sequential state, native retry of the second iteration without repeating the first, failure stopping later iterations, and cancellation. The local CLI reports zero in its `retries` field even after retrying, so this check verifies the task attempt records alongside process audit events. Loop evidence is written to `.scratch/loop-observations.json`.

Other evidence is written to `.scratch/local-observations.json` and `.scratch/lifecycle-observations.json`. Render's local dev server is in-memory; keep it running between lifecycle calls. Stop the owned server and disposable database when done.

## Packaged consumer and application example

Build and pack the provider, then install the archive in `examples/editorial-review` as described by its README. This consumes the package's actual exports/declarations, without TypeScript aliases to source or monorepo linking. Run the example's typecheck and start its own Render local dev worker on port 8139.

With the example worker running and `DATABASE_URL`, `RENDER_USE_LOCAL_DEV=true`, `RENDER_LOCAL_DEV_URL=http://127.0.0.1:8139`, `RENDER_WORKFLOW_SLUG=editorial-local`, and `APP_BUILD_ID=editorial-demo-v1` set:

```sh
node node_modules/tsx/dist/cli.mjs scripts/example-smoke.ts
```

The HTTP check starts and restarts an example backend on port 4318. It verifies unauthorized requests, invalid input, owner isolation for lookup/cancellation, an asynchronous accepted response, backend restart and successful reconnection, explicit failure, and real cancellation. It closes the backend processes it owns. Results are recorded in `.scratch/example-observations.json`. The example makes no model calls in deterministic mode.

See [hosted validation](hosted-validation.md) for real Render deployment results, the deterministic HTTP check and a separate real-agent check using OpenAI GPT-4.1 mini. Production deploy transitions during active runs, workspace rate pressure, other model providers, agent tool loops, Studio streaming and unpublished Mastra core compatibility remain unverified.

## Security regression checks

`src/security.test.ts` rejects fabricated children and tampered payloads, owner/step/execution mismatches, terminal or canceled parents, expired/closed authority, and preserves signed retries/key reordering. `src/example-security.test.ts` checks that HTTP admission denial occurs before any workflow submission. These cases failed against the original implementation before the fixes.

Run `scripts/admission-smoke.ts` with a real disposable PostgreSQL connection. It checks atomic cross-pool limits, duplicate reservation, owner/input conflicts, process reconstruction, per-owner/global rate and active limits, window rollover, uncertain/canceling holds, terminal release, circuit breaker, and provider/storage failures. Keep this separate from model tests: rate rejection must not generate model calls.

A deployed verification must include both a bounded successful agent workflow and a fabricated native child invocation rejected before business effects. Verify native retry counts and parent links, retained history, reconnects and ownership. For quota checks, use dedicated test owners/isolated namespaces; never saturate the shared Render workspace. No security claim is made against trusted operators who can read and replay still-authorized task arguments.

## Native metadata, nesting and root retries

`scripts/native-worker.ts` and `scripts/native-smoke.ts` are test fixtures. They use separate audit/fault tables to verify effects and inject one root process exit or timeout. Do not use this worker as an application entrypoint.

Start a dedicated local worker with the same database/local SDK environment as above:

```sh
render workflows dev --port 8151 -- node node_modules/tsx/dist/cli.mjs scripts/native-worker.ts
```

Point the caller at port 8151 and run:

```sh
NATIVE_TEST_MODES=success,child-retry,nested-failure,cancel \
  node node_modules/tsx/dist/cli.mjs scripts/native-smoke.ts
```

CLI 2.28.0 omits SDK 1.2.0 native metadata. Local mode can verify signed nesting and existing execution, but cannot verify identity enforcement or root retries. Unit tests check that retries fail explicitly in this situation.

For hosted verification, deploy this test worker to an existing dedicated paid Workflow service with shared PostgreSQL. Build with `npm ci --include=dev --ignore-scripts && npm run build`. Keep `APP_BUILD_ID` and `RENDER_WORKFLOW_SLUG` identical between caller and worker. Configure a funded model with `NATIVE_TEST_MODEL` and its provider secret on the worker. Only the external caller needs `RENDER_API_KEY`; neither process should enable local mode.

Run `scripts/native-smoke.ts` against the database's external connection string. Its default modes add `root-crash`, `root-timeout` and `agent`. Assertions check native ancestry, child-only retry, nested failure/cancel propagation, two native attempts after injected root failure, repeated completed steps with fresh initial state, stable public IDs, isolated snapshots, and a real Mastra agent result. Synthetic evidence is saved to `.scratch/native-observations.json`.

The in-process suite additionally rejects forged native ancestry, superseded descendant dispatch, mixed providers, graph cycles, definition overflow, unauthorized child workflows and forbidden state/context mutations. It checks SDK idempotency forwarding against a local HTTP endpoint. Hosted evidence belongs in [hosted validation](hosted-validation.md), with actual run IDs and explicit remaining gaps.
