import { appendFileSync } from 'node:fs';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod';
import { RedisStreamsPubSub } from '../src/index';

export function contextSnapshot(requestContext: RequestContext | undefined) {
  const user = requestContext?.get('mastra__user') as { id?: string } | undefined;
  const executions = requestContext?.get('mastra__durableExecutions') as
    | Record<string, { executionId?: string }>
    | undefined;
  return {
    marker: requestContext?.get('resume-marker'),
    user: user?.id,
    executionIds: Object.values(executions ?? {}).map(claim => claim.executionId),
  };
}

export function createCrossHostRuntime(config: {
  host: string;
  schemaName: string;
  connectionString: string;
  redisUrl: string;
  modelUrl: string;
  logFile: string;
  worker: boolean;
  /** Also log the context tool-result output processing sees. */
  observeToolResults?: boolean;
}) {
  const log = (event: string, requestContext: RequestContext | undefined, extra: Record<string, unknown> = {}) =>
    appendFileSync(
      config.logFile,
      `${JSON.stringify({ host: config.host, pid: process.pid, event, ...contextSnapshot(requestContext), ...extra })}\n`,
    );
  const storage = new PostgresStore({
    id: `${config.schemaName}_${config.host}`,
    schemaName: config.schemaName,
    connectionString: config.connectionString,
  });
  const pubsub = new RedisStreamsPubSub({ url: config.redisUrl, keyPrefix: config.schemaName, blockMs: 100 });
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${config.modelUrl}/v1` });
  const approve = createTool({
    id: 'approve',
    description: 'Approve the operation',
    inputSchema: z.object({}),
    requireApproval: true,
    execute: async (_input, context) => {
      log('tool-execute', context?.requestContext);
      return { approved: true };
    },
  });
  const agent = new Agent({
    id: 'cross-host',
    name: 'Cross host',
    instructions: 'Ask for approval.',
    durable: { executionEngine: 'evented' },
    memory: new Memory({ storage, options: { generateTitle: false } }),
    model: openai('gpt-4o-mini'),
    // Each caller also gets a tool only they may use, so the log shows whose tools a step was offered.
    tools: ({ requestContext }) => {
      const user = contextSnapshot(requestContext).user ?? 'anonymous';
      return {
        approve,
        [`${user}_only`]: createTool({
          id: `${user}_only`,
          description: `Only for ${user}`,
          inputSchema: z.object({}),
          execute: async () => ({ user }),
        }),
      };
    },
    inputProcessors: [
      {
        id: 'observe-context',
        processInputStep: ({ requestContext, tools }) =>
          log('input-step', requestContext, { tools: Object.keys(tools ?? {}).sort() }),
        processLLMRequest: ({ requestContext }) => log('llm-request', requestContext),
      },
    ],
    outputProcessors: [
      {
        id: 'observe-output',
        processOutputResult: ({ messages, requestContext }) => {
          log('output-result', requestContext);
          return messages;
        },
        ...(config.observeToolResults
          ? {
              processOutputStream: async ({ part, requestContext }) => {
                if (part.type === 'tool-result') log('tool-result', requestContext);
                return part;
              },
            }
          : {}),
      },
    ],
  });
  const mastra = new Mastra({ agents: { agent }, storage, pubsub, ...(config.worker ? {} : { workers: false }) });
  return { mastra, agent, storage };
}
