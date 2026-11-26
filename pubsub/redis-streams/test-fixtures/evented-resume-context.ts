import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod';
import { RedisStreamsPubSub } from '../src/index';

export function createResumeContextRuntime(config: {
  schemaName: string;
  connectionString: string;
  redisUrl: string;
  modelUrl: string;
  worker: boolean;
}) {
  const storage = new PostgresStore({
    id: config.schemaName,
    schemaName: config.schemaName,
    connectionString: config.connectionString,
  });
  const pubsub = new RedisStreamsPubSub({ url: config.redisUrl, keyPrefix: config.schemaName, blockMs: 100 });
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${config.modelUrl}/v1` });
  const agent = new Agent({
    id: 'resume-context',
    name: 'Resume context',
    instructions: 'Ask for approval.',
    durable: { executionEngine: 'evented' },
    memory: new Memory({ storage, options: { generateTitle: false } }),
    model: openai('gpt-4o-mini'),
    tools: {
      lookup: createTool({
        id: 'lookup',
        description: 'Look up the record before requesting approval',
        inputSchema: z.object({}),
        execute: async () => ({ found: true }),
      }),
      approve: createTool({
        id: 'approve',
        description: 'Approve the operation',
        inputSchema: z.object({}),
        requireApproval: true,
        execute: async () => ({ approved: true }),
      }),
    },
    inputProcessors: [
      {
        id: 'observe-resume-context',
        processInputStep: ({ requestContext }) => {
          console.log(`input-step:${requestContext?.get('resume-marker')}`);
        },
        processLLMRequest: ({ requestContext }) => {
          console.log(`llm-request:${requestContext?.get('resume-marker')}`);
        },
      },
    ],
    outputProcessors: [{ id: 'keep-messages', processOutputResult: ({ messages }) => messages }],
  });
  const mastra = new Mastra({ agents: { agent }, storage, pubsub, ...(config.worker ? {} : { workers: false }) });
  return { mastra, agent, storage };
}
