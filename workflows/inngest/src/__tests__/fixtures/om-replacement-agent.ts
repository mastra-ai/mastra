import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

export function buildOmReplacementAgent({
  dbUrl,
  agentId,
  inngestPort,
  mockUrl,
  observationalMemory,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
  mockUrl: string;
  observationalMemory: boolean;
}) {
  const inngest = new Inngest({ id: `om-replacement-${agentId}`, baseUrl: `http://localhost:${inngestPort}` });
  const storage = new DefaultStorage({ id: `om-replacement-${agentId}`, url: dbUrl });
  const provider = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mockUrl}/v1` });
  const memory = new Memory({
    storage,
    options: observationalMemory
      ? {
          observationalMemory: {
            enabled: true,
            observation: { model: provider.chat('observer'), messageTokens: 100_000, bufferTokens: false },
            reflection: { model: provider.chat('observer'), observationTokens: 100_000 },
          },
        }
      : {},
  });
  const specialist = new Agent({
    id: `${agentId}-specialist`,
    name: 'specialist',
    instructions: 'Ask questions.',
    model: provider.chat('specialist'),
    tools: {
      ask: createTool({
        id: 'ask',
        description: 'Ask a question',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async ({ question }, context) => context?.agent?.resumeData ?? context?.agent?.suspend({ question }),
      }),
    },
  });
  const supervisor = new Agent({
    id: agentId,
    name: 'supervisor',
    instructions: 'Delegate.',
    model: provider.chat('supervisor'),
    agents: { [specialist.id]: specialist },
    memory,
  });
  const durableAgent = createInngestAgent({ agent: supervisor, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const mastra = new Mastra({
    storage,
    agents: { [agentId]: durableAgent, [specialist.id]: specialist },
    workflows: { [workflow.id]: workflow },
  });
  return { inngest, mastra, durableAgent, memory };
}
