# @mastra/workflow

Run Mastra workflows on the [Workflow SDK](https://workflow-sdk.dev) — Vercel's durable execution runtime.

> **Experimental:** `@mastra/workflow` is under active development and is not ready for production use yet.

You keep authoring workflows with the Mastra API you already know. Each run executes inside the Workflow SDK, so steps are durable and replayable, `suspend()` parks on a real hook instead of holding a process open, and `.sleep()` survives a deploy.

## Installation

```bash
npm install @mastra/workflow workflow @mastra/core zod
```

## Setup

Two files. The first is the one that's easy to miss.

### 1. Register the runner in your `workflows/` directory

The Workflow SDK compiler discovers durable code by scanning your project's `workflows/` directory. Create one file there that re-exports this package's runner and imports your Mastra entrypoint:

```ts
// workflows/mastra.ts
export * from '@mastra/workflow/workflows';
import '../src/mastra';
```

Both lines are load-bearing:

- **The re-export** puts the runner and its steps into your build, so the compiler can assign them ids and register them.
- **The side-effect import** loads your Mastra workflow definitions in the process that runs steps. Steps look the live `Workflow` object up by id at execution time; without this import that lookup finds nothing and every step fails. The error message will point you back here if you forget.

### 2. Create workflows with `init()`

```ts
// src/mastra/workflows/index.ts
import { init } from '@mastra/workflow';
import { mastraRunner } from '@mastra/workflow/workflows';
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

Under the hood a suspended step waits on a Workflow SDK hook whose token is `` `mastra:${runId}:${stepId}` `` (with `:${index}` appended inside a `foreach`). That token shape is part of this package's public contract, so you can also resume from anywhere that knows the run and step id — a webhook handler, say — without holding the `Run` object:

```ts
import { resumeHook } from 'workflow/api';

await resumeHook(`mastra:${runId}:approval`, { approved: true });
```

Prefer that form across process boundaries. `run.resume()` can only *await the result* in the process that started the run (see limitations).

## Watching a run

`run.watch(cb)` and `run.stream()` work as usual. Both read a namespaced Workflow SDK stream, so you can also consume Mastra's events directly:

```ts
import { getRun } from 'workflow/api';

const events = getRun(sdkRunId).getReadable({ namespace: 'mastra:events' });
```

The stream carries Mastra's own event types: `workflow-start`, `workflow-step-start`, `workflow-step-result`, `workflow-step-suspended`, `workflow-step-finish`, and `workflow-finish`.

## Supported today

`.then()`, `.parallel()`, `.branch()`, `.dowhile()`, `.dountil()`, `.foreach()` (with static or resolved concurrency), `.sleep()`, `.sleepUntil()`, workflow state via `setState`, `suspend()`/`resume()`, `bail()`, per-step retries via `step.retries`, and event streaming.

## Not supported yet

These throw a clear error rather than misbehaving quietly:

- **Nested workflows** — a workflow used as a step.
- **Time travel** — `run.timeTravel()` and `timeTravelStream()`.
- **`streamLegacy()`** and the `perStep` option.

Also worth knowing:

- **`.map()` is untested.** It should work — a mapping step is an ordinary step in the graph — but nothing verifies that yet.
- **Cross-process `run.resume()` cannot await its result.** The Workflow SDK assigns its own run id, and this package does not yet persist the Mastra-to-SDK run id mapping. Resuming from another process works via `resumeHook()`; only awaiting the outcome through the `Run` object needs the original process.
- **Upgrading this package breaks in-flight runs.** The Workflow SDK derives step ids from the package specifier and version, so a version bump renames every step this package ships and runs recorded against the old ids cannot replay. Drain in-flight runs before upgrading.

## How it works

The integration keeps a hard line between two runtimes.

A single generic `"use workflow"` function, `mastraRunner`, is the only durable workflow. It receives your workflow's **serialized step graph** as run input and walks it deterministically inside the Workflow SDK's sandbox. That walker (`src/workflows/walker.ts`) has no runtime imports at all — every effect it needs is injected — which is what keeps `@mastra/core` and Node builtins out of the sandbox bundle.

Every piece of your code — step `execute` bodies, `.branch()` predicates, loop conditions, sleep resolvers — runs on the host through a `"use step"` dispatcher, which resolves the live `Workflow` object from a registry and invokes the real function with a Mastra execution context.

Two details are worth calling out because they are load-bearing rather than incidental:

- **Replay identity.** The Workflow SDK matches journal entries by position and validates them by step *name*. Because every operation here flows through the same dispatcher, that check cannot tell two graph nodes apart. The dispatcher therefore echoes back the identity of the node it actually ran, and the walker asserts it matches the node it is standing on — so a divergent replay fails loudly instead of feeding one step's output to another.
- **Retries.** Mastra owns retry policy through `step.retries`, applied by the walker. Workflow SDK-level retries are switched off on the dispatcher so the two policies don't multiply.

## Development

```bash
pnpm --filter @mastra/workflow build
pnpm --filter @mastra/workflow test:unit          # walker + registry, no runtime needed
pnpm --filter @mastra/workflow test:integration   # real Workflow SDK runtime via @workflow/vitest
```

The integration suite runs against a live Workflow SDK runtime using a fixture in `integration/` shaped like a consumer app — including the mandatory `workflows/mastra.ts` re-export file.
