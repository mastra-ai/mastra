# @mastra/workflow-sdk

Run Mastra workflows on the [Workflow SDK](https://workflow-sdk.dev) — Vercel's durable execution runtime.

> **Experimental:** `@mastra/workflow-sdk` is under active development and is not ready for production use yet.

You keep authoring workflows with the Mastra API you already know. Each run executes inside the Workflow SDK, so steps are durable and replayable, `suspend()` parks on a real hook instead of holding a process open, and `.sleep()` survives a deploy.

## Installation

```bash
npm install @mastra/workflow-sdk workflow @mastra/core zod
```

## Setup

Two files. The first is the one that's easy to miss.

### 1. Register the runner in your `workflows/` directory

The Workflow SDK compiler discovers durable code by scanning your project's `workflows/` directory. Create one file there that re-exports this package's runner and imports your Mastra entrypoint:

```ts
// workflows/mastra.ts
export * from '@mastra/workflow-sdk/workflows';
import '../src/mastra';
```

Both lines are load-bearing:

- **The re-export** puts the runner and its steps into your build, so the compiler can assign them ids and register them.
- **The side-effect import** loads your Mastra workflow definitions in the process that runs steps. Steps look the live `Workflow` object up by id at execution time; without this import that lookup finds nothing and every step fails. The error message will point you back here if you forget.

### 2. Create workflows with `init()`

```ts
// src/mastra/workflows/index.ts
import { init } from '@mastra/workflow-sdk';
import { mastraRunner } from '@mastra/workflow-sdk/workflows';
import { z } from 'zod';

const { createWorkflow, createStep } = init({ runner: mastraRunner });

const increment = createStep({
  id: 'increment',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
});

export const incrementWorkflow = createWorkflow({
  id: 'increment-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
})
  .then(increment)
  .commit();
```

Register the workflow with your `Mastra` instance as usual, then run it:

```ts
const run = await mastra.getWorkflow('incrementWorkflow').createRun();
const result = await run.start({ inputData: { value: 1 } });
// { status: 'success', result: { value: 2 }, input: …, steps: { increment: … } }
```

`init()` returns `{ createWorkflow, createStep, createTool, cloneStep, cloneWorkflow }`.

### Framework setup

Follow the [Workflow SDK setup guide](https://workflow-sdk.dev) for your framework. For Next.js that means wrapping your config in `withWorkflow` from `workflow/next`.

## Suspend and resume

`suspend()` works exactly as it does on other Mastra engines:

```ts
const approval = createStep({
  id: 'approval',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ approved: z.boolean() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ question: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({ question: `Approve ${inputData.value}?` });
      return { approved: false };
    }
    return { approved: resumeData.approved };
  },
});
```

`run.start()` returns a `suspended` result as soon as the step parks. Resume it with:

```ts
await run.resume({ step: 'approval', resumeData: { approved: true } });
```

Under the hood a suspended step waits on a Workflow SDK hook whose token is `` `mastra:${runId}:${stepId}` ``. Inside a `.foreach()` the element's index is appended — `` `mastra:${runId}:${stepId}:${index}` `` — because several copies of one step can be suspended at once; the index is zero-based and counts across the whole array, not within a concurrency batch. That token shape is part of this package's public contract, so you can also resume from anywhere that knows the run and step id — a webhook handler, say — without holding the `Run` object:

```ts
import { resumeHook } from 'workflow/api';

await resumeHook(`mastra:${runId}:approval`, { approved: true });
```

### Resuming from another process

`run.resume()` works from a process that did not start the run — an API route resuming a run a background job began, for example — as long as your `Mastra` instance has **storage** configured:

```ts
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  }),
  workflows: { approvalWorkflow },
});
```

Then, from any process:

```ts
const run = await mastra.getWorkflow('approvalWorkflow').createRun({ runId });
const result = await run.resume({ step: 'approval', resumeData: { approved: true } });
```

Point `DATABASE_URL` at a shared database rather than a `file:` path if you deploy to serverless. The mapping is only useful when every process reads the same store, and a file-backed database gives each invocation its own empty copy — which surfaces as exactly the `its Workflow SDK run id is unknown` error the storage is there to prevent.

The Workflow SDK assigns each run its own id and will not accept Mastra's, so the two ids have to be mapped somewhere. This package records the mapping on the Mastra run snapshot, which is also what makes `run.watch()` and `run.cancel()` work from a second process. Without storage there is nowhere to keep it, and those three methods throw an error saying so rather than silently doing nothing.

Use `resumeHook()` when you want to resume without waiting for the run to finish, or when the resuming process has no `Mastra` instance at hand. It returns as soon as the hook is released. `run.resume()` waits for the run to reach its next stopping point and hands back the `WorkflowResult`.

## Watching a run

`run.watch(cb)` and `run.stream()` work as usual. Both read a namespaced Workflow SDK stream, so you can also consume Mastra's events directly:

```ts
import { getRun } from 'workflow/api';

const events = getRun(sdkRunId).getReadable({ namespace: 'mastra:events' });
```

The stream carries Mastra's own event types: `workflow-start`, `workflow-step-start`, `workflow-step-result`, `workflow-step-suspended`, `workflow-step-waiting` (sleep steps), `workflow-step-progress` (foreach iterations), `workflow-step-output` (custom `writer` events), `workflow-step-finish`, and `workflow-finish`.

## Capabilities vs the default engine

| Capability                                                                                                             | Default engine | `@mastra/workflow-sdk`                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `.then()`, `.parallel()`, `.branch()`, `.dowhile()`, `.dountil()`, `.foreach()`, `.map()`, `.sleep()`, `.sleepUntil()` | ✅             | ✅                                                                                                           |
| Nested workflows (a workflow used as a step), including suspend/resume at any depth                                    | ✅             | ✅                                                                                                           |
| `suspend()` / `resume()` — optional `step` when only one step is parked, resume labels, `retryCount`                   | ✅             | ✅                                                                                                           |
| Workflow state (`setState`), `bail()`, per-step retries via `step.retries`                                             | ✅             | ✅                                                                                                           |
| Input/output/state/resume/suspend schema validation (`validateInputs`)                                                 | ✅             | ✅                                                                                                           |
| Step scorers and `disableScorers`                                                                                      | ✅             | ✅                                                                                                           |
| `onFinish` / `onError` lifecycle callbacks                                                                             | ✅             | ✅                                                                                                           |
| Tracing (`tracingOptions`, `tracingContext` in steps, spans linked into one trace)                                     | ✅             | ✅ (per-op spans linked by persisted trace/span ids — no live parent span object across ops)                 |
| `run.watch()`, `run.stream()` (including `closeOnSuspend: false`), custom events via `writer`                          | ✅             | ✅                                                                                                           |
| `abort()` inside a step, `run.cancel()` (external cancellation aborts in-flight steps best-effort)                     | ✅             | ✅                                                                                                           |
| Snapshot persistence (`shouldPersistSnapshot`, `suspendedPaths`, `resumeLabels`, `getWorkflowRunById`)                 | ✅             | ✅                                                                                                           |
| `perStep` execution option (`start({ perStep: true })`, one step per `resume()`)                                       | ✅             | ✅ (parallel branches run sequentially while paused)                                                         |
| Time travel — `run.timeTravel()` / `timeTravelStream()` (any step, nested targets, `perStep`, suspend/resume)          | ✅             | ✅ (starts a fresh Workflow SDK run seeded with the historical step results)                                 |
| `run.restart()`                                                                                                        | ✅             | ✅ (starts a fresh Workflow SDK run seeded from the interrupted snapshot, including interrupted nested runs) |
| `streamLegacy()`                                                                                                       | ✅             | ❌ throws                                                                                                    |

The unsupported method needs journal introspection the Workflow SDK does not expose; it throws a clear error rather than misbehaving quietly.

Also worth knowing:

- **`resume()`, `watch()` and `cancel()` from another process need storage** on your `Mastra` instance. See [Resuming from another process](#resuming-from-another-process).
- **External cancellation is best-effort.** `run.cancel()` marks the run canceled and the dispatcher aborts the local `AbortSignal` of any in-flight step, but a step that ignores its signal may still run to completion before the run settles as `canceled`.
- **Only some worlds pin a run to a deployment.** On Vercel a run finishes on the deployment that started it, so upgrading this package leaves runs already in flight alone. `@workflow/world-postgres` uses a constant deployment id, and `@workflow/world-local` pins to the Workflow SDK's version rather than this package's, so on those two a run suspended across an upgrade resumes against the new code. Step ids published by a package embed that package's version, so the resumed step fails with `Step "..." is not registered in the current deployment` — which reads like a bundling fault but is really the version change. That is how those worlds treat any package shipping steps; it is not specific to Mastra.

## How it works

The integration keeps a hard line between two runtimes.

A single generic `"use workflow"` function, `mastraRunner`, is the only durable workflow. It receives your workflow's **serialized step graph** as run input and walks it deterministically inside the Workflow SDK's sandbox. Every effect that walker (`src/workflows/walker.ts`) needs is injected, and its only runtime import is `constants.ts`, which imports nothing itself — that is what keeps `@mastra/core` and Node builtins out of the sandbox bundle.

Every piece of your code — step `execute` bodies, `.branch()` predicates, loop conditions, sleep resolvers — runs on the host through a `"use step"` dispatcher, which resolves the live `Workflow` object from a registry and invokes the real function with a Mastra execution context.

Two details are worth calling out because they are load-bearing rather than incidental:

- **Replay identity.** The Workflow SDK matches journal entries by position and validates them by step _name_. Because every operation here flows through the same dispatcher, that check cannot tell two graph nodes apart. The dispatcher therefore echoes back the identity of the node it actually ran, and the walker asserts it matches the node it is standing on — so a divergent replay fails loudly instead of feeding one step's output to another.
- **Retries.** Mastra owns retry policy through `step.retries`, applied by the walker. Workflow SDK-level retries are switched off on the dispatcher so the two policies don't multiply.

## Development

```bash
pnpm --filter @mastra/workflow-sdk build
pnpm --filter @mastra/workflow-sdk test:unit          # walker + registry, no runtime needed
pnpm --filter @mastra/workflow-sdk test:integration   # real Workflow SDK runtime via @workflow/vitest
```

The integration suite runs against a live Workflow SDK runtime using a fixture in `integration/` shaped like a consumer app — including the mandatory `workflows/mastra.ts` re-export file.
