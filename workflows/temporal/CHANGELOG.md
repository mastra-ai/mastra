# @mastra/temporal

## 0.1.2-alpha.5

### Patch Changes

- Updated dependencies [[`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962)]:
  - @mastra/core@1.33.0-alpha.5
  - @mastra/deployer@1.33.0-alpha.5

## 0.1.2-alpha.4

### Patch Changes

- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a)]:
  - @mastra/core@1.33.0-alpha.4
  - @mastra/deployer@1.33.0-alpha.4

## 0.1.2-alpha.3

### Patch Changes

- Updated dependencies [[`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047)]:
  - @mastra/core@1.33.0-alpha.3
  - @mastra/deployer@1.33.0-alpha.3

## 0.1.2-alpha.2

### Patch Changes

- Updated dependencies [[`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529)]:
  - @mastra/core@1.33.0-alpha.2
  - @mastra/deployer@1.33.0-alpha.2

## 0.1.2-alpha.1

### Patch Changes

- Updated dependencies [[`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d)]:
  - @mastra/core@1.33.0-alpha.1
  - @mastra/deployer@1.33.0-alpha.1

## 0.1.2-alpha.0

### Patch Changes

- Fixed peer dependency ranges so packages that use the Mastra server require a compatible Mastra core version. ([#16208](https://github.com/mastra-ai/mastra/pull/16208))

- Updated dependencies [[`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60), [`0011a7e`](https://github.com/mastra-ai/mastra/commit/0011a7e2bba6a4fc97a638c3f4089c0e9308b37c)]:
  - @mastra/core@1.33.0-alpha.0
  - @mastra/deployer@1.33.0-alpha.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`cc0469d`](https://github.com/mastra-ai/mastra/commit/cc0469d671d6f7a426013e4425f9501da6fa45f2)]:
  - @mastra/core@1.32.1
  - @mastra/deployer@1.32.1

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies [[`cc0469d`](https://github.com/mastra-ai/mastra/commit/cc0469d671d6f7a426013e4425f9501da6fa45f2)]:
  - @mastra/core@1.32.1-alpha.0
  - @mastra/deployer@1.32.1-alpha.0

## 0.1.0

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

### Patch Changes

- Updated dependencies [[`6dcd65f`](https://github.com/mastra-ai/mastra/commit/6dcd65f2a34069e6dc43ba35f1d11119b9b40bef), [`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`c05c9a1`](https://github.com/mastra-ai/mastra/commit/c05c9a13230988cef6d438a62f37760f31927bc7), [`ca28c23`](https://github.com/mastra-ai/mastra/commit/ca28c232a2f18801a6cf20fe053479237b4d4fb0), [`e24aacb`](https://github.com/mastra-ai/mastra/commit/e24aacba07bd66f5d95b636dc24016fca26b52cf), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`1d64a76`](https://github.com/mastra-ai/mastra/commit/1d64a765861a0772ea187bab76e5ed37bf82d042), [`1c2dda8`](https://github.com/mastra-ai/mastra/commit/1c2dda805fbfccc0abf55d4cb20cc34402dc3f0c), [`c721164`](https://github.com/mastra-ai/mastra/commit/c7211643f7ac861f83b19a3757cc921487fc9d75), [`1b55954`](https://github.com/mastra-ai/mastra/commit/1b559541c1e08a10e49d01ffc51a634dfc37a286), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`a0d9b6d`](https://github.com/mastra-ai/mastra/commit/a0d9b6d6b810aeaa9e177a0dcc99a4402e609634), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`70017d7`](https://github.com/mastra-ai/mastra/commit/70017d72ab741b5d7040e2a15c251a317782e39e), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e), [`b0c7022`](https://github.com/mastra-ai/mastra/commit/b0c70224f80dad7c0cdbfb22cbff22e0f75c064f), [`e4942bc`](https://github.com/mastra-ai/mastra/commit/e4942bc7fdc903572f7d84f26d5e15f9d39c763d)]:
  - @mastra/core@1.32.0
  - @mastra/deployer@1.32.0

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
