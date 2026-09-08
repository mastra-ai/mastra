import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { Mastra } from '@mastra/core/mastra';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { simulateReadableStream } from 'ai';
import { Inngest } from 'inngest';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

function recallProbeModel(): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'finish-side-effects-model',
    supportedUrls: {},
    async doGenerate() {
      return {
        content: [{ type: 'text', text: 'Durable Thread Title' }],
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
    async doStream(options: any) {
      const prompt = JSON.stringify(options?.prompt ?? []).toLowerCase();
      const reply = prompt.includes('zebra') ? 'recall:yes' : 'recall:no';
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'finish-side-effects-response',
              modelId: 'finish-side-effects-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: reply },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

const uppercaseOutputProcessor = {
  id: 'uppercase-finish-output',
  processOutputResult: async ({ messages }: { messages: MastraDBMessage[] }) =>
    messages.map(message => ({
      ...message,
      content: {
        ...message.content,
        parts: message.content.parts.map(part =>
          part.type === 'text' ? { ...part, text: part.text.toUpperCase() } : part,
        ),
      },
    })),
};

export function buildFinishSideEffectsAgent({
  dbUrl,
  agentId,
  inngestPort,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
}) {
  const inngest = new Inngest({ id: 'finish-side-effects-test', baseUrl: `http://localhost:${inngestPort}` });
  const storage = new DefaultStorage({ id: `finish-side-effects-${agentId}`, url: dbUrl });

  const agent = new Agent({
    id: agentId,
    name: 'Finish Side Effects Agent',
    instructions: 'Reply briefly.',
    model: recallProbeModel(),
    memory: new Memory({ storage, options: { generateTitle: true } }),
    outputProcessors: [uppercaseOutputProcessor],
  });

  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const mastra = new Mastra({
    storage,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
  });

  return { durableAgent, inngest, mastra };
}
