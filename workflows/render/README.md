# Mastra on Render Workflows

An experimental execution provider for Mastra. Developers author Mastra graphs; Render runs each business step as a separate task. The root task uses Mastra's existing execution engine to coordinate the graph. Child tasks retain Render retries, task resources, timeouts, parent relationships and cancellation.

`@renderinc/mastra` is a provisional, private local package. It has not been published or approved as an official integration. This implementation is pinned to `@mastra/core` 1.67.0 and `@renderinc/sdk` 1.2.0. It has not been verified against the repository's newer unpublished core.

**Reliability boundary:** roots default to zero retries. You can opt into native root retries, which restart the entire graph from its original input and state. They do not resume from snapshots or reuse completed steps. Child tasks can retry independently. Make external effects idempotent wherever retries are enabled; there is no exactly-once guarantee.

## Build and install locally

Requirements: Node 22.13 or newer, npm, PostgreSQL for separate caller/worker processes, and Render CLI for local task execution. The verified environment used Node 24.18.0, Render CLI 2.28.0 and PostgreSQL 17.9.

From this package directory:

```sh
mkdir -p .scratch/tmp .scratch/npm-cache
export TMPDIR="$PWD/.scratch/tmp"
export npm_config_cache="$PWD/.scratch/npm-cache"
npm ci --workspaces=false --include=dev --ignore-scripts --no-audit --no-fund
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

`provider.getRun` exposes `submitting`, `submission-unknown`, `pending`, `running`, `cancel-requested`, `success`, `failed` and `canceled`. Render's native `paused` status while a root waits for children maps to `running`; it is not Mastra suspend/resume. `workflow.getWorkflowRunById` merges persisted Mastra snapshots with provider status. The core snapshot type represents `submitting` and `submission-unknown` as `pending`; use the provider record for exact submission state. The core `WorkflowResult` has no canceled member, so a canceled `run.start()` resolves as failed with an `AbortError`; the provider and snapshot retain `canceled`.

Authenticate in your backend and check `record.resourceId` before returning a result or calling cancellation. These library APIs are trusted server APIs, not authorization middleware. The example enforces ownership before any provider request. It derives ownership from server-issued tokens, not a browser-supplied user ID.

Do not assume Mastra's HTTP client's `start` and `startAsync` have the same semantics as the core methods. This package does not replace Mastra server routes. The example uses its own authenticated HTTP endpoints calling core `startAsync` and acknowledges only after submission is accepted and persisted. Full Studio/server streaming compatibility is not claimed.

## Supported graph and context

| Surface                                                                                                      | Contract                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit steps, sequences, parallel, branch, foreach, dowhile, dountil                                       | Business steps dispatch through native Render task context. Each foreach or loop iteration has its own execution identity.                                                                                                 |
| Map functions, branch predicates and loop conditions                                                         | Pure operations in the root. No separate task or retry boundary. Mutation and unsupported control methods are guarded. External side effects in these functions remain the developer's responsibility to avoid.            |
| JSON input and output                                                                                        | Schema validation plus strict JSON checks at transport boundaries. No undefined, Date, class instances, functions, BigInt, non-finite numbers or cycles. Use strings for timestamps and explicit codecs for richer values. |
| Sequential state and request context                                                                         | `setState` and allowlisted context changes return from a child and are applied by the root. Getters expose immutable copies.                                                                                               |
| Parallel, branch or foreach state/context                                                                    | Read only. Shared mutations fail; there is no implicit merge order.                                                                                                                                                        |
| Context                                                                                                      | Worker-local `mastra`, input/state, IDs, `getInitData`, `getStepResult`, sequential `setState` and allowlisted `requestContext`.                                                                                           |
| Agents inside explicit steps                                                                                 | The entire step is one task and retry boundary. The adapter does not split model/tool calls automatically.                                                                                                                 |
| Retry, timeout and compute                                                                                   | Native task policies. Per-step `render` overrides provider defaults. A workflow's `render` overrides root defaults. Root retries default to zero; opt-in retries restart that entire workflow.                             |
| Reconnection and cancellation                                                                                | Persisted root binding, provider lookup, completion events, actual Render cancellation.                                                                                                                                    |
| Nested Mastra workflows                                                                                      | Same-provider graphs dispatch child coordinators through `ctx.run`, preserving state/context and snapshot links.                                                                                                           |
| Native nested tasks                                                                                          | Supported through the worker-scoped helper below. Native grandchildren are not automatically Mastra steps.                                                                                                                 |
| Suspend/resume, durable sleep, scheduling, checkpoint replay, restart/time travel, bulk run listing/deletion | Explicitly unsupported in this version. Unsupported graph entries fail before submission.                                                                                                                                  |
| Streaming, event watchers, live tracing context, scorers, actor transport, per-step start/output overrides   | Explicitly unsupported. Render completion events are not agent token streaming.                                                                                                                                            |

Set `requestContextKeys: ['locale']` to allow those keys across processes. There are no implicit keys. Values must be JSON. Avoid putting credentials or live objects into the context: task inputs and prior outputs are visible in Render execution history.

An entire task argument envelope, including original input, prior outputs and state, must fit within the conservative 4,000,000-byte adapter limit. Large documents should use references to an application object store. This adapter also bounds its serialized results to that size. The registry checks the service's 500-definition limit, including explicitly declared native tasks. `maxConcurrentSteps` defaults to 16 per root; it does not enforce Render's workspace-wide task-rate quota. Cross-job backpressure belongs in the application.

## Repeat a step until a condition is met

Use Mastra's `.dowhile(step, condition)` or `.dountil(step, condition)` with an explicit step. Both execute the step at least once. Each iteration receives the previous output and runs as a separate Render child task, with that step's native retry, timeout and compute policy. Successful earlier iterations are not rerun when a later child retries.

For an existing `revise` step whose input and output share `draftSchema`, stop when its score reaches the target or after five rounds:

```ts
const workflow = createWorkflow({
  id: 'iterative-review',
  inputSchema: draftSchema,
  outputSchema: draftSchema,
})
  .dountil(revise, async ({ inputData, iterationCount }) => inputData.score >= 8 || iterationCount >= 5)
  .commit();
```

The condition receives the current output, state and one-based `iterationCount`. It runs in the root and must be pure. Sequential state and allowlisted request-context updates from a child are available to the condition and next iteration. Include a stopping condition and size the root timeout for all iterations and retry delays. Loop bodies can be explicit steps or nested workflows from this provider. Suspend/resume and coordinator checkpoint replay are unsupported.

## Nest Mastra workflows

A workflow created by the same `init(...)` instance can be used as a step:

```ts
const reviewPipeline = createWorkflow({
  id: 'review-pipeline',
  inputSchema: editorial.inputSchema,
  outputSchema: editorial.outputSchema,
})
  .then(editorial)
  .commit();
```

The parent chains a child coordinator through native `ctx.run`; that coordinator chains its own business steps. Reachable child definitions are registered automatically, including children used in parallel, foreach or loop bodies. All must use the same provider and Render Workflow service. Mixed providers, cyclic graphs and more than 500 registered definitions fail before submission.

Nested execution preserves Mastra input/output validation, state, allowlisted request context, resource ownership and configured workflow authorization. Read-only restrictions from parallel, branch and foreach execution apply to descendants. Snapshots retain nested-run links. Cancel the top-level run to cancel the whole native tree; child-only cancellation is not exposed by the adapter.

## Opt into root restart retries

```ts
const workflow = createWorkflow({
  id: 'retryable-review',
  inputSchema: review.inputSchema,
  outputSchema: review.outputSchema,
  render: {
    timeoutSeconds: 600,
    retry: { maxRetries: 1, waitDurationMs: 1000, backoffScaling: 2 },
  },
})
  .then(review)
  .commit();
```

`rootTask.retry` sets the provider default; `createWorkflow({ render: { retry } })` overrides it for that workflow. This policy also applies when the workflow is nested. Retrying a nested coordinator restarts only that nested graph, unless its failure also causes its parent to retry.

Render schedules retries. Every attempt runs the graph again with the original input/state, a new dispatch authority and separate Mastra snapshots. Public run IDs remain stable. Superseded attempts cannot publish the current result or dispatch additional adapter children. This does not reverse external effects or stop external work already in flight. Use application idempotency keys for writes, including lifecycle callbacks.

This feature requires native task metadata. Hosted Render supplies it with SDK 1.2.0. CLI 2.28.0 does not, so local root retries fail explicitly. Ordinary local execution, including nesting, retains signed dispatch when `client.useLocalDev`, `client.localDevUrl` or the Render local-development environment is explicitly configured. Do not enable local mode in hosted workers.

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

- A run ID can be submitted only once. A durable unique key and compare-and-swap revisions protect the binding. Native identity prevents binding a second Render root to the same run. A private claim fences each coordinator attempt.
- A timeout or network error while submitting can mean Render accepted the task but the caller did not receive the ID. The adapter preserves the existing run and throws `RenderSubmissionUnknownError`. Never automatically submit another root. Inspect Render execution history and the persisted run. A hosted worker can repair the binding from its native metadata after it starts. Until then, retain the uncertain submission and inspect its history.
- If binding persistence fails after acceptance, the record may temporarily lack the provider ID until the worker claims it. Keep the returned run ID for operator diagnosis. Do not assume the job failed or resubmit blindly. Transactional submission across Render and PostgreSQL is not implemented.
- A child can retry without rerunning successful siblings. A root timeout or process loss fails the attempt. With root retries enabled, Render can start the graph again; otherwise the run fails. It does not resume from the latest Mastra snapshot. Size root timeouts for the full graph, including retry delays, and account for the coordinating root's resources.
- Cancellation is a request until Render confirms its outcome. Completion can win the race. Cancellation does not undo external side effects.
- Worker and caller manifest/build mismatch fails before business code. Deploy matching definitions; do not mutate an already registered workflow. Root and child policies are included in the manifest.
- `createMemoryPersistence()` is only for same-process tests. Separate worker/caller processes require durable shared persistence. `createPostgresPersistence()` creates only `mastra_render_runs`; it requires table-creation privileges initially. Configure database TLS and connection pooling for the deployment.

## Example and verification

See [the editorial review app](examples/editorial-review/README.md) for a complete asynchronous browser/backend/worker example. It defaults to deterministic feedback with no model calls; optional agent mode requires explicit model configuration. Refresh/reconnect, ownership checks, failure reporting and real cancellation are part of the example.

See [verification instructions](docs/verification.md) for unit/type checks, real Render CLI subprocess tests, PostgreSQL lifecycle tests and package-consumer checks. See [hosted validation](docs/hosted-validation.md) for real Render task execution, retry and cancellation evidence, and [upstream follow-up](docs/upstream.md) for work intentionally deferred by the package-only repository boundary.

Reference documentation: [Render Workflows](https://render.com/docs/workflows), [defining tasks](https://render.com/docs/workflows-defining), [TypeScript SDK](https://render.com/docs/workflows-sdk-typescript), [execution limits](https://render.com/docs/workflows-limits).

## Generated task authorization

Generated roots and business-step tasks are internal adapter entrypoints. Submit through the Mastra workflow API. Roots must match the complete persisted submission and native run identity before acquiring an attempt claim. Children require a matching active run and an HMAC-SHA-256 proof over their complete payload, signed by that coordinator. The signing secret stays in the run store and coordinator memory; do not expose raw persistence records to clients. Signing happens before `ctx.run`, so argument-size checks include the proof. Cancellation, coordinator completion, timeout and attempt replacement revoke dispatch authority. Descendants also validate their ancestor attempts. Database failures reject execution before business effects.

SDK 1.2.0 supplies native task, root and parent IDs. Hosted generated children verify these IDs as well as the signed payload, preventing a copied envelope from being invoked under a different native parent. Explicit local development falls back to signed payload checks when the CLI supplies no metadata. In that mode, a trusted operator can replay an authorized payload while its coordinator remains active. Neither mode is a boundary against database/worker administrators. Native retries deliberately reuse their input; business effects must remain idempotent.

The root binding now includes a submission hash and dispatch lifetime fields inside the existing JSON record. Existing completed history remains readable. Drain active runs and deploy matching caller/worker builds together; do not reuse a build ID for changed adapter code. Old pending submissions without the new binding must be reconciled, not blindly resubmitted. The implementation does not modify core Mastra or Render SDK source. Existing roots still default to zero retries.

### Completion after an uncertain submission

If Render accepts a root but its response or the caller's binding write is lost, do not submit a new run. The adapter passes a stable native submission idempotency key and keeps its one-shot logical run reservation. Render's key is scoped to one Workflow version and retained for 24 hours; it is not permanent deduplication or checkpoint recovery.

When the hosted coordinator starts, it records its own task/root IDs from native metadata before business execution. This repairs a lost caller binding, allowing later status lookup and cancellation through Render. If neither process can reach persistence, execution fails closed. A run whose acceptance remains unknown still requires operator reconciliation; the adapter does not blindly resubmit or maintain another retry scheduler.

Explicit local mode preserves the older fallback: a worker that completes without native metadata or a caller-written task ID can record its terminal Mastra result. Cancellation is unavailable until that local run has a native ID. Deploy matching caller and worker builds together after draining existing active runs.
