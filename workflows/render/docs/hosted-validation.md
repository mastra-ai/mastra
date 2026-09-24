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
