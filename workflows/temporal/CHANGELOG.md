# @mastra/temporal

## 0.1.0-alpha.3

### Patch Changes

- Updated dependencies [[`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`1d64a76`](https://github.com/mastra-ai/mastra/commit/1d64a765861a0772ea187bab76e5ed37bf82d042), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`a0d9b6d`](https://github.com/mastra-ai/mastra/commit/a0d9b6d6b810aeaa9e177a0dcc99a4402e609634)]:
  - @mastra/core@1.32.0-alpha.4
  - @mastra/deployer@1.32.0-alpha.4

## 0.1.0-alpha.2

### Patch Changes

- Updated dependencies [[`ca28c23`](https://github.com/mastra-ai/mastra/commit/ca28c232a2f18801a6cf20fe053479237b4d4fb0)]:
  - @mastra/core@1.32.0-alpha.3
  - @mastra/deployer@1.32.0-alpha.3

## 0.1.0-alpha.1

### Patch Changes

- Updated dependencies [[`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e)]:
  - @mastra/core@1.32.0-alpha.2
  - @mastra/deployer@1.32.0-alpha.2

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
