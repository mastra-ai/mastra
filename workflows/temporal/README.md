# @mastra/temporal

Run Mastra workflows on [Temporal](https://temporal.io/) with a workflow authoring API that stays close to standard Mastra workflows.

> **Experimental:** `@mastra/temporal` is under active development and is not ready for production use yet.

## Installation

```bash
npm install @mastra/temporal @temporalio/client @temporalio/worker @temporalio/envconfig
```

## Define a Temporal-backed workflow

The following example demonstrates the same pattern used in the `temporal-snapshot` app: create a Temporal client, call `init()`, and define workflows with `createWorkflow()` and `createStep()`.

```ts
import { z } from 'zod';
import { init } from '@mastra/temporal';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { Client, Connection } from '@temporalio/client';

const config = loadClientConnectConfig();
const connection = await Connection.connect(config.connectionOptions);
const client = new Client({ connection });

const { createWorkflow, createStep } = init({
  client,
  taskQueue: 'mastra',
});

const fetchWeather = createStep({
  id: 'fetch-weather',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ forecast: z.string() }),
  execute: async ({ inputData }) => {
    return {
      forecast: `Sunny in ${inputData.city}`,
    };
  },
});

export const weatherWorkflow = createWorkflow({
  id: 'weather-workflow',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ forecast: z.string() }),
}).then(fetchWeather);
```

## Register the workflow in your Mastra entry file

`MastraPlugin` precompiles your Mastra entry file into dedicated workflow and activity modules before Temporal starts. Point the plugin at the file where your `Mastra` instance registers workflows.

```ts
import { Mastra } from '@mastra/core/mastra';
import { weatherWorkflow } from './workflows/weather-workflow';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
});
```

## Start a Temporal worker

Create a worker, install `MastraPlugin`, and call `await plugin.init()` before `Worker.create()`. Use the Mastra entry file as `src`.

```ts
import { NativeConnection, Worker } from '@temporalio/worker';
import { MastraPlugin } from '@mastra/temporal/worker';

const connection = await NativeConnection.connect({
  address: 'localhost:7233',
});

const plugin = new MastraPlugin({
  src: import.meta.resolve('./mastra/index.ts'),
});

await plugin.init();

const worker = await Worker.create({
  connection,
  namespace: 'default',
  taskQueue: 'mastra',
  plugins: [plugin],
});

await worker.run();
```

## How it works

- `init({ client, taskQueue })`: Returns `createWorkflow()` and `createStep()` helpers for Temporal-backed Mastra workflows.
- `MastraPlugin({ src })`: Point it at the Mastra entry file that registers workflows.
- `await plugin.init()`: Precompiles the Mastra app into `node_modules/.mastra/output/index.mjs`, then generates `node_modules/.mastra/workflow.mjs` for workflow bundling and `node_modules/.mastra/activities.mjs` for activity execution before the Temporal worker starts.
- Generated activities: The plugin extracts `createStep()` handlers into `node_modules/.mastra/activities.mjs` and wires them into the worker automatically.
- `debug: true`: Writes emitted workflow bundles to `node_modules/.mastra` for inspection.

## Notes

- Workflow ids must be statically defined so the transformer can derive Temporal export names.
- The plugin expects `src` to point to the Mastra entry file that registers workflows in `new Mastra({ workflows: ... })`.
- Call `await plugin.init()` before `Worker.create()` so the compiled workflow entry is ready when Temporal configures the worker and bundler.

## License

Apache-2.0
