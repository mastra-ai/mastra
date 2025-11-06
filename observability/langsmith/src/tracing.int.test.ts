import 'dotenv/config';

import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { Observability } from '@mastra/observability';
import { Client } from 'langsmith';
import { it } from 'vitest';
import { z } from 'zod';
import { LangSmithExporter } from './tracing';

it.skip('should initialize with correct configuration', async () => {
  const client = new Client();
  const calculator = createTool({
    id: 'calculator',
    description: 'Add two numbers',
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    outputSchema: z.object({ result: z.number() }),
    execute: async input => ({ result: input.a + input.b }),
  });

  const agent = new Agent({
    id: 'agent',
    name: 'Agent',
    instructions: 'Use tools when helpful.',
    model: openai('gpt-5-nano'),
    tools: { calculator },
  });

  const mastra = new Mastra({
    agents: { agent },
    observability: new Observability({
      configs: {
        langsmith: {
          serviceName: 'ai',
          exporters: [new LangSmithExporter({ logLevel: 'debug', client })],
        },
      },
    }),
  });

  const res = await mastra.getAgent('agent').generate('What is 21 + 21? Use tools if needed.');
  console.log(res?.text ?? res);

  const stream = await mastra.getAgent('agent').stream('What is 21 + 21? Use tools if needed.');
  console.log(await stream.text);

  // TODO: Flush properly
  await new Promise(resolve => setTimeout(resolve, 1000));
  await client.awaitPendingTraceBatches();
}, 30000);
