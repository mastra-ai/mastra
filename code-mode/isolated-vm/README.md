# @mastra/isolated-vm

`IsolatedVmCodeModeTransport` runs model-authored Code Mode programs inside an in-process V8 isolate. Use it when you need a strong execution boundary without starting a separate sandbox process; the isolate has no direct filesystem, network, or process access.

## Installation

```bash
npm install @mastra/isolated-vm
```

## Usage

On Node.js 20 and later, start the host process with `--no-node-snapshot` because `isolated-vm` is a native addon.

```typescript
import { Agent } from '@mastra/core/agent';
import { createCodeMode, createTool } from '@mastra/core/tools';
import { IsolatedVmCodeModeTransport } from '@mastra/isolated-vm';
import { z } from 'zod';

const getPrice = createTool({
  id: 'getPrice',
  description: 'Get the price of a product',
  inputSchema: z.object({ productId: z.string() }),
  outputSchema: z.object({ price: z.number() }),
  execute: async ({ productId }) => ({ price: productId === 'pro' ? 49 : 19 }),
});

const { tool, instructions } = createCodeMode(
  { tools: { getPrice } },
  new IsolatedVmCodeModeTransport({ memoryLimitMb: 128 }),
);

const agent = new Agent({
  id: 'pricing-agent',
  name: 'Pricing agent',
  instructions: ['Answer pricing questions.', instructions],
  model: 'openai/gpt-5.6-sol',
  tools: { execute_typescript: tool },
});
```

## Documentation

- [Reference: IsolatedVmCodeModeTransport](https://mastra.ai/reference/tools/isolated-vm-transport)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/code-mode/isolated-vm/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
