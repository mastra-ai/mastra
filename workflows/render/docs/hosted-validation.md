# Hosted validation

Hosted validation was authorized after the initial local delivery. The target is the `samples` Render workspace, using a dedicated Workflow service, web example and PostgreSQL database. Results will be recorded here after the checks run.

The fork branch is `feat/render-workflows`. Deployment configuration is confined to this package.

## Reproducible build

Set the service root directory to `workflows/render` and use:

```sh
bash scripts/build-editorial-example.sh
```

The script builds and packs the provider, installs the example's dependencies and then installs the actual provider archive into the example. It does not install the monorepo workspace or rely on a published integration package.

Workflow run command:

```sh
node examples/editorial-review/node_modules/tsx/dist/cli.mjs examples/editorial-review/worker.ts
```

Web start command:

```sh
node examples/editorial-review/node_modules/tsx/dist/cli.mjs examples/editorial-review/server.ts
```

Both processes require matching `APP_BUILD_ID`, `RENDER_WORKFLOW_SLUG` and `DATABASE_URL`, and `REVIEW_MODE=deterministic` for tests without model calls. Set `NODE_VERSION=24.18.0` and `TSX_DISABLE_CACHE=1`. Do not set `RENDER_USE_LOCAL_DEV` for hosted operation.

The web service additionally needs `HOST=0.0.0.0`, a Render-assigned `PORT`, `DEMO_API_TOKENS` with strong random values, and `RENDER_API_KEY` for task submission and lookup. The worker uses the native task context to chain tasks and does not need a management API key. `/healthz` checks the HTTP process; it is not proof that database access or workflow submission works.

Credentials belong in the Render environment and ignored local test configuration. Do not commit connection strings, tokens or populated environment files. The demo's configured bearer tokens remain a demonstration authentication scheme.

## Repeat the application checks

Set `DEMO_BASE_URL` to your deployed example, `DEMO_TEST_TOKEN` to one configured user's bearer token, and `DEMO_OTHER_TOKEN` to a different user's token. Optionally set `DEMO_RESULTS_FILE` to an ignored output file. Then run from the package directory:

```sh
TMPDIR="$PWD/.scratch/tmp" TSX_DISABLE_CACHE=1 \
  node node_modules/tsx/dist/cli.mjs scripts/hosted-smoke.ts
```

This creates three real jobs. It checks health, authentication, validation, asynchronous acceptance, duplicate submission, input conflicts, owner isolation, deterministic output, child failure and cancellation. It refuses agent mode. Job IDs are printed before submission so an interrupted test can reconnect without blindly resubmitting.

## Defect found during hosted validation

The initial deployment at `c708b97a51ec17ce2bbbfdaf57ebb6084e81e2e0` registered successfully, but its first root failed before dispatching children. Mastra's `createRun` calls `getWorkflowRunById` while hydrating the worker run. The adapter unnecessarily reconciled that lookup through the management API, requiring a worker API key.

The fix associates the active handler with its Mastra workflow/run identity and reads the persisted binding for that exact worker-local lookup. Caller lookups still reconcile authoritative Render status. Native child dispatch continues through the task context, and the worker requires no management API credential. The regression fails before the fix and passes afterward.

The next hosted graph completed successfully but polling exposed an unhandled native `paused` status while the root awaited its children. The adapter now treats that status as an active Mastra `running` execution and preserves a pending cancellation. This does not add Mastra suspend/resume. A second regression covers lookup and cancellation through this state.
