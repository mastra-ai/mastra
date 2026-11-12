import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createAnswerSimilarityScorer, createTrajectoryAccuracyScorerCode } from '@mastra/evals/scorers/prebuilt';
import { Memory } from '@mastra/memory';
import { DefaultExporter, Observability } from '@mastra/observability';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod/v4';
import { MastraServer } from '../../index';

/**
 * The provider is the only fake: recording, HTTP, memory, tools, storage and scorers are real.
 * `replayLastMessages` serves the HTTP API from an agent whose memory recall differs from the one that recorded.
 */
export async function goldenThreadFixture({ replayLastMessages }: { replayLastMessages?: number | false } = {}) {
  const liveCalls: number[] = [];
  const storage = new InMemoryStore();
  const memoryOptions = {
    workingMemory: {
      enabled: true,
      scope: 'resource' as const,
      template: '# Customer\nAda Lovelace',
      useStateSignals: true,
    },
  };
  const memory = new Memory({ storage, options: { lastMessages: 10, ...memoryOptions } });
  const model = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      const userIndex = prompt.findLastIndex(
        message =>
          message.role === 'user' &&
          message.content.some(part => part.type === 'text' && /Please check order \d+\./.test(part.text)),
      );
      const user = prompt[userIndex];
      const question =
        user?.role === 'user'
          ? user.content
              .filter(part => part.type === 'text')
              .map(part => part.text)
              .join('')
          : '';
      const orderId = Number(question.match(/order (\d+)/i)?.[1] ?? 1);
      const hasResult = prompt.slice(userIndex + 1).some(message => message.role === 'tool');
      return {
        content: hasResult
          ? [{ type: 'text', text: `Order ${orderId} is ready for pickup, Ada.` }]
          : [
              {
                type: 'tool-call',
                toolCallId: `order-${orderId}`,
                toolName: 'lookupOrder',
                input: JSON.stringify({ orderId }),
              },
            ],
        finishReason: hasResult ? 'stop' : 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        warnings: [],
      };
    },
  });
  const lookupOrder = createTool({
    id: 'lookupOrder',
    description: 'Read the customer order status',
    inputSchema: z.object({ orderId: z.number().int().positive() }),
    execute: async ({ orderId }) => {
      liveCalls.push(orderId);
      return { orderId, status: 'ready', customer: 'Ada' };
    },
  });
  // A deterministic judge at the provider boundary, driven by the actual scorer prompts.
  const judge = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      const text = prompt
        .filter(message => message.role === 'user')
        .flatMap(message => message.content)
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('');
      let answer: string;
      if (text.includes('Agent Output:\n')) {
        const output = text.split('Agent Output:\n')[1]!.split('\n\nGround Truth:')[0]!.trim();
        const groundTruth = text.split('Ground Truth:\n')[1]!.split('\n\nRequired JSON')[0]!.trim();
        answer = JSON.stringify({ outputUnits: [output], groundTruthUnits: [groundTruth] });
      } else if (text.includes('Output Units:\n')) {
        const outputs: string[] = JSON.parse(text.split('Output Units:\n')[1]!.split('\n\nGround Truth Units:')[0]!);
        const truths: string[] = JSON.parse(text.split('Ground Truth Units:\n')[1]!.split('\n\nRequired JSON')[0]!);
        answer = JSON.stringify({
          matches: truths.map(groundTruthUnit => ({
            groundTruthUnit,
            outputUnit: outputs[0] ?? null,
            matchType: outputs.includes(groundTruthUnit) ? 'exact' : 'missing',
            explanation: 'Compare the recorded answer with the replay answer.',
          })),
          extraInOutput: [],
          contradictions: [],
        });
      } else answer = 'The replay answer matches the recorded answer exactly.';
      return {
        content: [{ type: 'text', text: answer }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
  });
  for (const provider of [model, judge]) {
    provider.doStream = async options => {
      const result = await provider.doGenerate(options);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          ...result.content.flatMap(part =>
            part.type === 'text'
              ? [
                  { type: 'text-start' as const, id: 'text' },
                  { type: 'text-delta' as const, id: 'text', delta: part.text },
                  { type: 'text-end' as const, id: 'text' },
                ]
              : part.type === 'tool-call'
                ? [part]
                : [],
          ),
          { type: 'finish', finishReason: result.finishReason, usage: result.usage },
        ]),
      };
    };
  }
  const trajectory = createTrajectoryAccuracyScorerCode({ comparisonOptions: { ordering: 'strict' } });
  const similarity = createAnswerSimilarityScorer({ model: judge });
  const agentConfig = {
    id: 'support',
    name: 'Order support',
    instructions: 'Help Ada check her order. Look up each order and report the result.',
    model,
    tools: { lookupOrder },
  };
  const agent = new Agent({ ...agentConfig, memory });
  const served =
    replayLastMessages === undefined
      ? agent
      : new Agent({
          ...agentConfig,
          memory: new Memory({ storage, options: { lastMessages: replayLastMessages, ...memoryOptions } }),
        });
  const mastra = new Mastra({
    agents: { support: served },
    scorers: { trajectory, similarity },
    storage,
    logger: false,
    observability: new Observability({
      configs: { replay: { serviceName: 'golden-replay', exporters: [new DefaultExporter()] } },
    }),
  });
  await memory.createThread({ threadId: 'golden-thread', resourceId: 'support' });
  await memory.updateWorkingMemory({
    threadId: 'golden-thread',
    resourceId: 'support',
    workingMemory: '# Customer\nAda Lovelace — priority support',
  });
  for (let turn = 1; turn <= 10; turn++) {
    await agent.generate(`Please check order ${turn}.`, {
      memory: { thread: { id: 'golden-thread' }, resource: 'support' },
    });
  }
  await mastra.observability.flush();
  const app = new Hono();
  app.use('*', cors());
  const server = new MastraServer({ app, mastra });
  await server.init();
  return { app, mastra, memory, storage, liveCalls, trajectory, similarity };
}
