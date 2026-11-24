/**
 * Shared by the span-outcome test and its connect workers: every process builds the same agent
 * and the same observability, so the run looks like one deploy with an API replica and a worker pool.
 */
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { simulateReadableStream } from 'ai';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

export const SPAN_OUTCOME_TRIPWIRE = {
  reason: 'Deploy preflight rejected this request',
  processorId: 'deploy-preflight',
};

/** Calls `step` until the transcript carries its result, then answers, so every process agrees on the turn. */
function stepThenTextModel(): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    async doStream({ prompt }: { prompt: Array<{ role: string }> }) {
      const stepped = prompt.some(message => message.role === 'tool');
      const chunks = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: stepped ? 'id-1' : 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
        ...(stepped
          ? [
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'done' },
              { type: 'text-end', id: 't1' },
            ]
          : [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'step',
                input: JSON.stringify({ n: 1 }),
                providerExecuted: false,
              },
            ]),
        {
          type: 'finish',
          finishReason: stepped ? 'stop' : 'tool-calls',
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        },
      ];
      return {
        stream: simulateReadableStream({ chunks: chunks as any }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

export function buildSpanOutcomeAgent({
  dbUrl,
  agentId,
  inngestPort,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
}) {
  const inngest = new Inngest({ id: 'span-outcome-test', baseUrl: `http://localhost:${inngestPort}` });
  const step = createTool({
    id: 'step',
    description: 'Perform numbered step n.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => ({ done: n }),
  });
  const storage = new DefaultStorage({ id: `span-outcome-${agentId}`, url: dbUrl });
  const agent = new Agent({
    id: agentId,
    name: 'Span Outcome Agent',
    instructions: 'Call step, then answer.',
    model: stepThenTextModel(),
    tools: { step },
    inputProcessors: [
      {
        id: SPAN_OUTCOME_TRIPWIRE.processorId,
        processInput: ({ messages, requestContext, abort }) => {
          if (requestContext?.get('blocked')) abort(SPAN_OUTCOME_TRIPWIRE.reason);
          return messages;
        },
      },
    ],
  });
  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const mastra = new Mastra({
    storage,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
    // Ended spans are inserted whole, so a worker's end never has to find a row another process wrote.
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'span-outcome-test',
          exporters: [new MastraStorageExporter({ strategy: 'insert-only', maxBatchWaitMs: 25 })],
        },
      },
    }),
  });
  return { inngest, mastra, durableAgent, storage };
}
