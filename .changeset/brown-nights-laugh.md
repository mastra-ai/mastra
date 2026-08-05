---
'@mastra/workflow-sdk': minor
---

Added `@mastra/workflow-sdk`, an experimental integration that runs Mastra workflows on the [Workflow SDK](https://workflow-sdk.dev), Vercel's durable execution runtime. Steps become durable and replayable, `suspend()` parks on a real hook instead of holding a process open, and `.sleep()` survives a deploy — while you keep authoring workflows with the Mastra API you already use.

**Setup.** Register the runner once in your project's `workflows/` directory. Both lines are required: the re-export puts the runner into your build, and the side-effect import loads your workflow definitions in the process that runs steps.

```ts
// workflows/mastra.ts
export * from '@mastra/workflow-sdk/workflows';
import '../src/mastra';
```

Then create workflows with `init()`:

```ts
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

Running a workflow is unchanged:

```ts
const run = await mastra.getWorkflow('incrementWorkflow').createRun();
const result = await run.start({ inputData: { value: 1 } });
```

**Resuming from anywhere.** A suspended step parks on a Workflow SDK hook, so it can be released from a route handler, a webhook, or another service. `run.resume()` works from a process that did not start the run as long as your `Mastra` instance has storage, and so do `run.watch()` and `run.cancel()`:

```ts
const run = await mastra.getWorkflow('approvalWorkflow').createRun({ runId });
const result = await run.resume({ step: 'approval', resumeData: { approved: true } });
```

Or release the hook directly by its token, which is part of the package's public contract:

```ts
import { resumeHook } from 'workflow/api';

await resumeHook(`mastra:${runId}:approval`, { approved: true });
```

**Supported:** `.then()`, `.parallel()`, `.branch()`, `.dowhile()`, `.dountil()`, `.foreach()`, `.map()`, `.sleep()`, `.sleepUntil()`, nested workflows (including suspend/resume at any depth), workflow state, `suspend()`/`resume()` (with resume labels and optional `step`), `bail()`, `abort()`/`run.cancel()`, schema validation, step scorers, `onFinish`/`onError` callbacks, tracing, per-step retries, `perStep` execution mode, time travel (`run.timeTravel()` and `run.timeTravelStream()`), `run.restart()`, and event streaming.

**Not supported yet:** `streamLegacy()` throws a clear error. The package is experimental and not ready for production use.
