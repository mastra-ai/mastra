---
'@mastra/workflow': minor
---

Added `@mastra/workflow`, an experimental integration that runs Mastra workflows on the [Workflow SDK](https://workflow-sdk.dev), Vercel's durable execution runtime. Steps become durable and replayable, `suspend()` parks on a real hook instead of holding a process open, and `.sleep()` survives a deploy — while you keep authoring workflows with the Mastra API you already use.

**Setup.** Register the runner once in your project's `workflows/` directory. Both lines are required: the re-export puts the runner into your build, and the side-effect import loads your workflow definitions in the process that runs steps.

```ts
// workflows/mastra.ts
export * from '@mastra/workflow/workflows';
import '../src/mastra';
```

Then create workflows with `init()`:

```ts
import { init } from '@mastra/workflow';
import { mastraRunner } from '@mastra/workflow/workflows';

const { createWorkflow, createStep } = init({ runner: mastraRunner });

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

**Supported:** `.then()`, `.parallel()`, `.branch()`, `.dowhile()`, `.dountil()`, `.foreach()`, `.sleep()`, `.sleepUntil()`, workflow state, `suspend()`/`resume()`, `bail()`, per-step retries, and event streaming.

**Not supported yet:** nested workflows, time travel, `streamLegacy()`, and `perStep` each throw a clear error. The package is experimental and not ready for production use.
