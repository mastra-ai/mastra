import 'dotenv/config';

import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Client } from 'langsmith';
import { it } from 'vitest';
import { z } from 'zod';
import { LangSmithExporter } from './ai-tracing';

it.skip('should initialize with correct configuration', async () => {
  const client = new Client();
  const calculator = createTool({
    id: 'calculator',
    description: 'Add two numbers',
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    outputSchema: z.object({ result: z.number() }),
    execute: async ({ context }) => ({ result: context.a + context.b }),
  });

  const agent = new Agent({
    name: 'Agent',
    instructions: 'Use tools when helpful.',
    model: openai('gpt-5-nano'),
    tools: { calculator },
  });

  const mastra = new Mastra({
    agents: { agent },
    observability: {
      configs: {
        langsmith: {
          serviceName: 'ai',
          exporters: [new LangSmithExporter({ logLevel: 'debug', client })],
        },
      },
    },
  });

  // Use generateVNext (AI SDK v5 method) with tools
  const res = await mastra.getAgent('agent').generateVNext('What is 21 + 21? Use tools if needed.');
  console.log(res?.text ?? res);

  // Use streamVNext for streaming responses
  const stream = await mastra.getAgent('agent').streamVNext('What is 21 + 21? Use tools if needed.');
  console.log(await stream.text);

  // TODO: Flush properly
  await new Promise(resolve => setTimeout(resolve, 1000));
  await client.awaitPendingTraceBatches();
}, 30000);
