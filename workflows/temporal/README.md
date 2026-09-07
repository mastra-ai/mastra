# @mastra/temporal

Run Mastra workflows on [Temporal](https://temporal.io/) with a workflow authoring API that stays close to standard Mastra workflows.

> **Experimental:** `@mastra/temporal` is under active development and is not ready for production use yet.

## Installation

```bash
npm install @mastra/temporal
```

## Usage

```ts
import { NativeConnection, Worker } from '@temporalio/worker';
import { MastraPlugin } from '@mastra/temporal/worker';

const connection = await NativeConnection.connect({
  address: 'localhost:7233',
});

const plugin = new MastraPlugin(import.meta.resolve('./mastra/index.ts'));

const worker = await Worker.create({
  connection,
  namespace: 'default',
  taskQueue: 'mastra',
  plugins: [plugin],
});

await worker.run();
```

## Documentation

- [Temporal deployment and worker guide](https://mastra.ai/integrations/deploy/temporal)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workflows/temporal/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
