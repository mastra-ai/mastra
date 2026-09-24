# Editorial review with Mastra and Render Workflows

A user submits a draft, three reviewers run in parallel, and a final step produces a revision. The browser receives a job ID, polls status, reconnects after refresh, and can cancel. The backend derives ownership from authentication and checks it before lookup/cancellation. The worker uses ordinary Mastra steps and agent calls. The provider dispatches them as native Render tasks.

The default `deterministic` mode makes no model calls. Its feedback is fixed diagnostic feedback and its revision normalizes whitespace; it is deliberately labeled in the interface. Agent mode uses real Mastra agents when explicitly configured.

## Install the local package

From `workflows/render/`, after the provider's dependencies are installed:

```sh
export TMPDIR="$PWD/.scratch/tmp"
export npm_config_cache="$PWD/.scratch/npm-cache"
npm run build --workspaces=false
npm pack --workspaces=false --pack-destination .scratch
npm install --prefix examples/editorial-review --workspaces=false --install-links --ignore-scripts --no-audit --no-fund
npm install --prefix examples/editorial-review --workspaces=false --no-save --ignore-scripts --no-audit --no-fund "$PWD/.scratch/renderinc-mastra-0.0.0.tgz"
```

The example declares a local file dependency because the integration is unpublished. Installing the archive explicitly verifies the packed artifacts. No workspace aliases to provider source are used.

## Configure and run

From `examples/editorial-review/`, copy `.env.example` to `.env`. Set:

- `DATABASE_URL`: a PostgreSQL database reachable by the backend and worker. The provider and Mastra snapshots share it.
- `APP_BUILD_ID`: the same immutable code/build identity on both processes.
- `RENDER_WORKFLOW_SLUG`: the local or deployed Workflow service slug.
- `DEMO_API_TOKENS`: a JSON map of demo usernames to random tokens of at least 16 characters. Enter one token in the browser. These are example credentials, not a production authentication system.
- `RENDER_USE_LOCAL_DEV=true` and `RENDER_LOCAL_DEV_URL=http://127.0.0.1:8139` for local development.

Start the Render development worker from this example directory:

```sh
render workflows dev --port 8139 -- node --env-file=.env node_modules/tsx/dist/cli.mjs worker.ts
```

In another terminal, from the same example directory:

```sh
npm run start --workspaces=false
```

Open `http://127.0.0.1:4318`. Connect with a configured token, submit a draft and wait for the result. Refresh during execution to reconnect using the job ID. The token lives in browser session storage; the job ID also lives in the URL and local storage. Neither a Render API key nor a database credential is sent to the browser.

To exercise failure reporting, select the demonstration-failure checkbox. To cancel, submit and immediately select Cancel. A fast job can complete before cancellation reaches Render; the interface reports the final provider outcome.

## Optional real agents

Set `REVIEW_MODE=agent`, `REVIEW_MODEL` to a model ID supported by the pinned Mastra version, and that model provider's credentials in the worker environment. Restart both processes with the same updated build identity. The same graph then calls worker-local `reviewer` and `editor` Mastra agents with structured output. A child retry can repeat a model call and its cost. Paid model execution has not been run as part of local verification.

## Boundaries

This example defaults to `127.0.0.1` for local evaluation. For a Render web service set `HOST=0.0.0.0` and use the platform-provided `PORT`; see [hosted validation](../../docs/hosted-validation.md) for build/start commands. Before deploying an application, integrate the host application's authentication, TLS, rate limits and retention policy. The demo uses configured bearer tokens and has no sign-up or token issuance flow. The core provider API assumes a trusted backend, so preserve the ownership checks when adapting it.

It uses custom HTTP routes calling the **core** `run.startAsync()`, which waits for remote acceptance and persistence. The client receives 202 only after that succeeds. Submission uncertainty is reported with the existing job ID and does not trigger automatic resubmission. The browser allocates and saves the job ID before submission, so a lost HTTP response can be reconciled by lookup. Repeating a request with the same ID and input retrieves the existing submission instead of creating another. Changed input or a different owner is rejected. Refresh and backend restart retrieve that same run.

No percentage progress, token streaming, workflow replay or root retry is claimed. A root failure is a failed job. Render completion/cancellation control comes from the provider; business steps do not call the Render SDK directly.
