/**
 * Shared agent definition for the cross-process suspend-metadata test.
 *
 * Both the driver (test process, calls `stream()`) and the worker (separate process, executes the
 * durable loop) build the SAME agent from this factory. That mirrors production, where a web
 * replica and a worker pool each construct the agent from the same code but keep their own
 * in-memory `globalRunRegistry`.
 */
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { simulateReadableStream } from 'ai';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

/** First turn calls the approval tool; a later turn answers with text. */
function toolCallThenText(): any {
  let call = 0;
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    async doStream() {
      call++;
      const chunks =
        call === 1
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'request_approval',
                input: JSON.stringify({ question: 'Proceed?' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
              },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model', timestamp: new Date(0) },
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'Done.' },
              { type: 'text-end', id: 't1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
            ];
      return {
        stream: simulateReadableStream({ chunks: chunks as any }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

export function buildSuspendMetaAgent({
  dbUrl,
  agentId,
  inngestPort,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
}) {
  const inngest = new Inngest({ id: 'suspend-metadata-test', baseUrl: `http://localhost:${inngestPort}` });

  const requestApproval = createTool({
    id: 'request_approval',
    description: 'Ask the user to approve before continuing',
    inputSchema: z.object({ question: z.string() }),
    suspendSchema: z.object({ question: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async (input: any, context: any) => {
      const agentCtx = context?.agent ?? context ?? {};
      if (agentCtx.resumeData != null) return { approved: agentCtx.resumeData.approved };
      await agentCtx.suspend?.({ question: input.question });
      return { approved: false };
    },
  });

  const storage = new DefaultStorage({ id: `suspend-meta-${agentId}`, url: dbUrl });

  const agent = new Agent({
    id: agentId,
    name: 'Suspend Meta Agent',
    instructions: 'Call request_approval, then confirm.',
    model: toolCallThenText(),
    tools: { request_approval: requestApproval },
    memory: new Memory({ storage }),
  });

  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });

  const mastra = new Mastra({
    storage,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
  });

  return { inngest, mastra, durableAgent, storage };
}
