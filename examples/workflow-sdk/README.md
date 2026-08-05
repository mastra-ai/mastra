# Mastra on the Workflow SDK

Runs a Mastra workflow on [Vercel's Workflow SDK](https://workflow-sdk.dev) using [`@mastra/workflow-sdk`](../../workflows/workflow-sdk). You author the workflow with the Mastra API you already know; each run executes durably inside the Workflow SDK, so `suspend()` parks on a real hook instead of holding a process open.

The example is a small Nitro server with an **order approval** workflow:

- `validate-order` — classifies the order as low or high risk (over $500 is high)
- `approve-order` — low-risk orders auto-approve; high-risk orders suspend until a human resumes the run
- `fulfill-order` — fulfills or rejects based on the approval

## Layout

| File | Purpose |
| --- | --- |
| `workflows/mastra.ts` | Registers the `@mastra/workflow-sdk` runner with the Workflow SDK compiler. Easy to miss, load-bearing — see the comments in the file. |
| `src/mastra/workflows/index.ts` | The workflow, authored with `init({ runner: mastraRunner })` — same `createWorkflow`/`createStep` API as `@mastra/core`. |
| `src/mastra/index.ts` | The `Mastra` instance. Storage (LibSQL) is required so a later request can resume a run started by an earlier one. |
| `server/api/` | Nitro routes to start, inspect, and approve runs. |
| `nitro.config.ts` | Adds the `workflow/nitro` module, which compiles the `"use workflow"` / `"use step"` directives and hosts the runtime. |

> The Workflow SDK needs its own build step (here provided by Nitro), so this example runs with `nitro dev` rather than `mastra dev`.

## Run it

The example links `@mastra/workflow-sdk`, `@mastra/core`, and `@mastra/libsql` from this repo, so build them first:

```sh
pnpm turbo build --filter ./workflows/workflow-sdk --filter ./stores/libsql
```

Then, from this directory:

```sh
pnpm install
ORDERS_API_TOKEN=dev-secret pnpm dev
```

All endpoints require `Authorization: Bearer $ORDERS_API_TOKEN`. This shared token is a minimal auth boundary for the example — anyone holding it can inspect and approve any run, so a production app should replace it with real authentication plus per-run ownership/approver checks.

```sh
export ORDERS_API_TOKEN=dev-secret
```

### Start an order

Low-risk orders complete immediately:

```sh
curl -X POST -H "Authorization: Bearer $ORDERS_API_TOKEN" --json '{"amount": 100}' http://localhost:3000/api/orders
# { "runId": "...", "status": "success", "result": { "orderId": "...", "status": "fulfilled" } }
```

High-risk orders suspend at `approve-order`:

```sh
curl -X POST -H "Authorization: Bearer $ORDERS_API_TOKEN" --json '{"amount": 700}' http://localhost:3000/api/orders
# { "runId": "...", "status": "suspended", "suspended": { "reason": "..." }, "resumeWith": "POST /api/orders/<runId>/approve" }
```

### Inspect the run

```sh
curl -H "Authorization: Bearer $ORDERS_API_TOKEN" http://localhost:3000/api/orders/<runId>
# { "runId": "...", "status": "suspended", "steps": { "validate-order": "success", "approve-order": "suspended" } }
```

### Approve (or reject) it

```sh
curl -X POST -H "Authorization: Bearer $ORDERS_API_TOKEN" --json '{"approved": true}' http://localhost:3000/api/orders/<runId>/approve
# { "runId": "...", "status": "success", "result": { "orderId": "...", "status": "fulfilled" } }
```

This resume happens on a different HTTP request than the one that started the run — that cross-request handoff is what the LibSQL storage on the `Mastra` instance enables.

You can also inspect the underlying Workflow SDK runs with:

```sh
npx workflow web
```

## Learn more

- [`@mastra/workflow-sdk` README](../../workflows/workflow-sdk/README.md) — setup details and the capability matrix vs the default engine
- [Workflow runners docs](https://mastra.ai/docs/deployment/workflow-runners)
