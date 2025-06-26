# Inngest Workflow Engine

Run Mastra workflows with Inngest.

Workflow and step execution functionality is exposed via `serve` from `@mastra/inngest`.
This is a wrapper that detects all Mastra workflows created to run with Inngest and registers them to the Inngest server.

Steps and workflows are created using the `createStep` and `createWorkflow` functions initialized with `init()` from `@mastra/inngest`.
This makes sure that all the steps are ready and able to connect with the Inngets runtime, publish events for watching, etc.

The Inngest runtime is horizontally scalable, with watching and eventing working through the `@inngest/realtime` package.

## Usage

### Running inngest dev server

```bash
docker run --rm -p 8288:8288 \
  inngest/inngest \
  inngest dev -u http://host.docker.internal:4111/inngest/api
```

### Example

```ts
import { init, serve as inngestServe } from '@mastra/inngest';
import { PinoLogger } from '@mastra/loggers';
import { Inngest } from 'inngest';
import { z } from 'zod';

const inngest = new Inngest({
  id: 'mastra',
  baseUrl: `http://localhost:8288`, // if using local dev server
});

const { createWorkflow, createStep } = init(inngest);

const incrementStep = createStep({
  id: 'increment',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { value: inputData.value + 1 };
  },
});

const sideEffectStep = createStep({
  id: 'side-effect',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    console.log('log', inputData.value);
    return { value: inputData.value };
  },
});

const finalStep = createStep({
  id: 'final',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { value: inputData.value };
  },
});

const incrementWorkflow = createWorkflow({
  id: 'increment-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .dountil(
    createWorkflow({
      id: 'increment-subworkflow',
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        value: z.number(),
      }),
      steps: [incrementStep, sideEffectStep],
    })
      .then(incrementStep)
      .then(sideEffectStep)
      .commit(),
    async ({ inputData }) => inputData.value >= 10,
  )
  .then(finalStep)
  .commit();

export const mastra = new Mastra({
  vnext_workflows: {
    incrementWorkflow,
  },
  server: {
    host: '0.0.0.0',
    apiRoutes: [
      {
        path: '/inngest/api', // this needs to match the path in inngest dev server (or production) config
        method: 'ALL',
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
      },
    ],
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```
