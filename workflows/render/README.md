# Mastra on Render Workflows

An experimental execution provider for Mastra. Developers author Mastra graphs; Render runs each business step as a separate task. The root task uses Mastra's existing execution engine to coordinate the graph. Child tasks retain Render retries, task resources, timeouts, parent relationships and cancellation.

`@renderinc/mastra` is a provisional, private local package. It has not been published or approved as an official integration. This implementation is pinned to `@mastra/core` 1.67.0 and `@renderinc/sdk` 1.1.0. It has not been verified against the repository's newer unpublished core.

**Reliability boundary:** the root has zero retries. A failed root fails the Mastra run; it does not replay the graph from snapshots. Each child can retry, so side effects in a child must be idempotent. There is no exactly-once guarantee. Use an application idempotency key for external writes.

## Build and install locally

Requirements: Node 22.13 or newer, npm, PostgreSQL for separate caller/worker processes, and Render CLI for local task execution. The verified environment used Node 24.18.0, Render CLI 2.28.0 and PostgreSQL 17.9.

From this package directory:

```sh
mkdir -p .scratch/tmp .scratch/npm-cache
export TMPDIR="$PWD/.scratch/tmp"
export npm_config_cache="$PWD/.scratch/npm-cache"
npm ci --workspaces=false --ignore-scripts --no-audit --no-fund
npm run build --workspaces=false
npm pack --workspaces=false --pack-destination .scratch
```

Install the generated `renderinc-mastra-0.0.0.tgz` into your application along with the pinned peers. The example below has a package-local installation path and does not require publishing. Do not run a repository-root installation for this isolated package.

## Author a workflow

```ts
// workflow.ts
import { init, createPostgresPersistence } from '@renderinc/mastra';
import { z } from 'zod';

export const persistence = createPostgresPersistence({
  connectionString: process.env.DATABASE_URL!,
});
export const { createWorkflow, createStep, provider } = init({
  workflowSlug: process.env.RENDER_WORKFLOW_SLUG!,
  buildId: process.env.APP_BUILD_ID!,
  persistence,
  rootTask: { plan: 'flex', timeoutSeconds: 600 },
  stepDefaults: {
    timeoutSeconds: 120,
    retry: { maxRetries: 2, waitDurationMs: 1000, backoffScaling: 2 },
  },
  maxConcurrentSteps: 8,
});

const review = createStep({
  id: 'review',
  inputSchema: z.object({ draft: z.string() }),
  outputSchema: z.object({ feedback: z.string() }),
  execute: async ({ inputData, mastra }) => {
    // mastra is the worker-local application. Agents can be called here.
    return { feedback: `Reviewed ${inputData.draft.length} characters` };
  },
});
export const editorial = createWorkflow({
  id: 'editorial',
  inputSchema: review.inputSchema,
  outputSchema: review.outputSchema,
})
  .then(review)
  .commit();
```

Register the workflow with a `Mastra` instance and a shared Mastra storage implementation, such as `PostgresStore` from `@mastra/pg`. The provider's PostgreSQL table stores the durable binding and final result; the Mastra store holds framework snapshots. The provider does not implement another queue. Use the same database and immutable `APP_BUILD_ID` in caller and worker. An application commit or build digest is suitable; change it whenever code, configuration or schemas change.

The worker entrypoint imports that same application and registers definitions synchronously:

```ts
// worker.ts
import { registerRenderTasks } from '@renderinc/mastra/worker';
import { mastra } from './mastra.js';
registerRenderTasks({ mastra });
```

Run the entrypoint in a Render Workflow service, or locally with `render workflows dev -- <worker command>`. The SDK starts the worker protocol when Render provides its socket. Do not run it as an ordinary always-on HTTP worker. In local development set `RENDER_USE_LOCAL_DEV=true` and `RENDER_LOCAL_DEV_URL` in the backend too. In hosted operation, configure the Render SDK credentials in the backend and keep them off the browser.

## Submit, reconnect and cancel

```ts
const run = await editorial.createRun({ resourceId: authenticatedUserId });
const { runId } = await run.startAsync({ inputData: { draft } });
// This core method returns after Render acceptance AND durable binding persistence.
// It does not wait for the final result. A backend can now return HTTP 202.

const record = await provider.getRun(editorial.id, runId);
// A later process can retrieve this same run. Never call start again to reconnect.
await provider.cancel(editorial.id, runId);
```

`run.start(...)` submits and waits for a typed Mastra result. `provider.wait(workflowId, runId, signal?)` also works after reconnection. It uses a Render completion event to wake the waiter, then reconciles authoritative status. A quiet or disconnected event stream falls back to polling after at most 30 seconds. Aborting this local wait does not cancel the task; use `cancel` explicitly.

`provider.getRun` exposes `submitting`, `submission-unknown`, `pending`, `running`, `cancel-requested`, `success`, `failed` and `canceled`. `workflow.getWorkflowRunById` merges persisted Mastra snapshots with provider status. The core snapshot type represents `submitting` and `submission-unknown` as `pending`; use the provider record for exact submission state. The core `WorkflowResult` has no canceled member, so a canceled `run.start()` resolves as failed with an `AbortError`; the provider and snapshot retain `canceled`.

Authenticate in your backend and check `record.resourceId` before returning a result or calling cancellation. These library APIs are trusted server APIs, not authorization middleware. The example enforces ownership before any provider request. It derives ownership from server-issued tokens, not a browser-supplied user ID.

Do not assume Mastra's HTTP client's `start` and `startAsync` have the same semantics as the core methods. This package does not replace Mastra server routes. The example uses its own authenticated HTTP endpoints calling core `startAsync` and acknowledges only after submission is accepted and persisted. Full Studio/server streaming compatibility is not claimed.

## Supported graph and context

| Surface                                                                                                                           | Contract                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit steps, sequences, parallel, branch, foreach                                                                              | Business steps dispatch through native Render task context. Each foreach iteration has its own execution identity.                                                                                                         |
| Map functions and branch predicates                                                                                               | Pure operations in the root. No separate task or retry boundary. Mutation and unsupported control methods are guarded. External side effects in these functions remain the developer's responsibility to avoid.            |
| JSON input and output                                                                                                             | Schema validation plus strict JSON checks at transport boundaries. No undefined, Date, class instances, functions, BigInt, non-finite numbers or cycles. Use strings for timestamps and explicit codecs for richer values. |
| Sequential state and request context                                                                                              | `setState` and allowlisted context changes return from a child and are applied by the root. Getters expose immutable copies.                                                                                               |
| Parallel, branch or foreach state/context                                                                                         | Read only. Shared mutations fail; there is no implicit merge order.                                                                                                                                                        |
| Context                                                                                                                           | Worker-local `mastra`, input/state, IDs, `getInitData`, `getStepResult`, sequential `setState` and allowlisted `requestContext`.                                                                                           |
| Agents inside explicit steps                                                                                                      | The entire step is one task and retry boundary. The adapter does not split model/tool calls automatically.                                                                                                                 |
| Retry, timeout and compute                                                                                                        | Native task policies. Per-step `render` overrides provider defaults. A workflow's `render` overrides root defaults. Root retry is always zero.                                                                             |
| Reconnection and cancellation                                                                                                     | Persisted root binding, provider lookup, completion events, actual Render cancellation.                                                                                                                                    |
| Native nested tasks                                                                                                               | Supported through the worker-scoped helper below. Native grandchildren are not automatically Mastra steps.                                                                                                                 |
| Suspend/resume, nested Mastra workflows, loops, durable sleep, scheduling, replay, restart/time travel, bulk run listing/deletion | Explicitly unsupported in this version. Unsupported graph entries fail before submission.                                                                                                                                  |
| Streaming, event watchers, live tracing context, scorers, actor transport, per-step start/output overrides                        | Explicitly unsupported. Render completion events are not agent token streaming.                                                                                                                                            |

Set `requestContextKeys: ['locale']` to allow those keys across processes. There are no implicit keys. Values must be JSON. Avoid putting credentials or live objects into the context: task inputs and prior outputs are visible in Render execution history.

An entire task argument envelope, including original input, prior outputs and state, must fit within the conservative 4,000,000-byte adapter limit. Large documents should use references to an application object store. This adapter also bounds its serialized results to that size. The registry checks the service's 500-definition limit, including explicitly declared native tasks. `maxConcurrentSteps` defaults to 16 per root; it does not enforce Render's workspace-wide task-rate quota. Cross-job backpressure belongs in the application.

## Use a native Render task inside a step

```ts
import { task } from '@renderinc/sdk/workflows';
import { getRenderTaskContext } from '@renderinc/mastra/runtime';

export const nativeTask = task({ name: 'native-enrichment' }, async (_ctx, text: string) => text.toUpperCase());
// In an explicit Mastra step's execute function:
const result = await getRenderTaskContext().run(nativeTask, inputData.text);
// At worker startup:
registerRenderTasks({ mastra, nativeTasks: [nativeTask] });
```

The native task must be registered at module startup in the same Render Workflow service. Use the active context to retain the child relationship. The helper throws outside a worker handler and is isolated across concurrent executions. Its native calls retain native policies and do not use the adapter's per-root dispatch limiter.

Generated root/step definitions are internal protocol endpoints. Starting one directly from the Dashboard or CLI does not create a valid Mastra run. Submit through `createRun().startAsync()` or an application API that calls it. There is no public raw-task submission entrypoint or automatic Python-handler translation.

## Failure and operational behavior

- A run ID can be submitted only once. A durable unique key and compare-and-swap revisions protect the binding. A worker claim prevents a second coordinator for the same run.
- A timeout or network error while submitting can mean Render accepted the task but the caller did not receive the ID. The adapter preserves the existing run and throws `RenderSubmissionUnknownError`. Never automatically submit another root. Inspect Render execution history and the persisted run. This release does not supply automated reconciliation without a provider ID.
- If binding persistence fails after acceptance, the record may remain `submitting` or `running` without the provider ID. Keep the returned run ID for operator diagnosis. Do not assume the job failed or resubmit blindly. Transactional submission across Render and PostgreSQL is not implemented.
- A child can retry without rerunning successful siblings. A root timeout, process loss or failed deployment interrupts orchestration and becomes a failed run. It does not resume from the latest Mastra snapshot. Size root timeouts for the full graph, including retry delays, and account for the coordinating root's resources.
- Cancellation is a request until Render confirms its outcome. Completion can win the race. Cancellation does not undo external side effects.
- Worker and caller manifest/build mismatch fails before business code. Deploy matching definitions; do not mutate an already registered workflow. Root and child policies are included in the manifest.
- `createMemoryPersistence()` is only for same-process tests. Separate worker/caller processes require durable shared persistence. `createPostgresPersistence()` creates only `mastra_render_runs`; it requires table-creation privileges initially. Configure database TLS and connection pooling for the deployment.

## Example and verification

See [the editorial review app](examples/editorial-review/README.md) for a complete asynchronous browser/backend/worker example. It defaults to deterministic feedback with no model calls; optional agent mode requires explicit model configuration. Refresh/reconnect, ownership checks, failure reporting and real cancellation are part of the example.

See [verification instructions](docs/verification.md) for unit/type checks, real Render CLI subprocess tests, PostgreSQL lifecycle tests and package-consumer checks. See [upstream follow-up](docs/upstream.md) for work intentionally deferred by the package-only repository boundary.

Reference documentation: [Render Workflows](https://render.com/docs/workflows), [defining tasks](https://render.com/docs/workflows-defining), [TypeScript SDK](https://render.com/docs/workflows-sdk-typescript), [execution limits](https://render.com/docs/workflows-limits).
