# @mastra/temporal

## 0.1.0-alpha.0

### Minor Changes

- Added the new `@mastra/temporal` package for running Mastra workflows on Temporal. ([#15789](https://github.com/mastra-ai/mastra/pull/15789))

  **What changed**
  - Added `init()` to create Temporal-backed Mastra workflows and steps.
  - Added `MastraPlugin` to bundle workflow code for Temporal workers and load generated activities.
  - Added `debug: true` support to write transformed workflow modules and emitted bundles to `.mastra/temporal`.

  **Example**

  ```ts
  import { init } from '@mastra/temporal';
  import { MastraPlugin } from '@mastra/temporal/worker';
  import { Client, Connection } from '@temporalio/client';
  import { Worker } from '@temporalio/worker';

  const connection = await Connection.connect();
  const client = new Client({ connection });
  const { createWorkflow, createStep } = init({ client, taskQueue: 'mastra' });

  const step = createStep({ id: 'hello', execute: async () => 'world' });
  export const helloWorkflow = createWorkflow({ id: 'hello-workflow' }).then(step);

  await Worker.create({
    connection,
    taskQueue: 'mastra',
    plugins: [new MastraPlugin({ src: import.meta.resolve('./mastra/index.ts') })],
  });
  ```
