# @mastra/quickjs

`QuickJsCodeModeTransport` runs model-authored Code Mode programs in a QuickJS runtime compiled to WebAssembly. Use it when native addons or Node.js startup flags are unavailable, such as in serverless environments, while keeping execution isolated from the host process.

## Installation

```bash
npm install @mastra/quickjs
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { createCodeMode, createTool } from '@mastra/core/tools';
import { QuickJsCodeModeTransport } from '@mastra/quickjs';
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
  new QuickJsCodeModeTransport({ memoryLimitMb: 128 }),
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

- [Code Mode guide](https://mastra.ai/docs/agents/code-mode)
- [QuickJsCodeModeTransport reference](https://mastra.ai/reference/tools/quickjs-transport)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/code-mode/quickjs/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
