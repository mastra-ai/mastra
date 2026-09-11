import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod';

export async function clientToolLifecycle(
  connectionString: string,
  bufferOnIdle: boolean,
  hooks: { beforeActorResponse?: () => void } = {},
) {
  const threadId = randomUUID();
  const resourceId = randomUUID();
  const storage = new PostgresStore({ id: `22573-${threadId}`, connectionString });
  const observerPrompts: unknown[] = [];
  const actorPrompts: unknown[] = [];
  const beforeHistory: unknown[] = [];
  const afterHistory: unknown[] = [];
  const observer = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      observerPrompts.push(prompt);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'observation' },
          {
            type: 'text-delta',
            id: 'observation',
            delta: '<observations>\n- User requested a client color change.\n</observations>',
          },
          { type: 'text-end', id: 'observation' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } },
        ]),
      };
    },
  });
  const makeMemory = (idle: boolean, messageTokens: number, bufferActivation?: number) =>
    new Memory({
      storage,
      options: {
        lastMessages: 20,
        semanticRecall: false,
        observationalMemory: {
          enabled: true,
          scope: 'thread',
          observation: { model: observer, messageTokens, bufferTokens: 0.5, bufferActivation, bufferOnIdle: idle },
        },
      },
    });
  const model = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      actorPrompts.push(prompt);
      hooks.beforeActorResponse?.();
      return {
        content:
          actorPrompts.length === 1
            ? [{ type: 'tool-call', toolCallId: '22573-color', toolName: 'changeColor', input: '{"color":"green"}' }]
            : [{ type: 'text', text: 'Color acknowledged.' }],
        finishReason: actorPrompts.length === 1 ? 'tool-calls' : 'stop',
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        warnings: [],
      };
    },
  });
  const makeAgent = (idle: boolean, messageTokens = 100000, bufferActivation?: number) => {
    const memory = makeMemory(idle, messageTokens, bufferActivation);
    const agent = new Agent({
      id: '22573-agent',
      name: 'Client color agent',
      instructions: 'Change the client color when requested.',
      model,
      memory,
      inputProcessors: [
        {
          id: '22573-capture',
          processInput: ({ messageList }) => {
            beforeHistory.push(structuredClone(messageList.get.all.db()));
            return messageList;
          },
          processInputStep: ({ messageList }) => {
            afterHistory.push(structuredClone(messageList.get.all.db()));
            return messageList;
          },
        },
      ],
    });
    return { agent, memory };
  };
  const { agent, memory } = makeAgent(bufferOnIdle);
  const options = {
    memory: { thread: threadId, resource: resourceId },
    clientTools: {
      changeColor: {
        id: 'changeColor',
        description: 'Change client color',
        inputSchema: z.object({ color: z.string() }),
      },
    },
  };
  await storage.init();
  return {
    agent,
    memory,
    storage,
    options,
    threadId,
    resourceId,
    actorPrompts,
    observerPrompts,
    beforeHistory,
    afterHistory,
    makeAgent,
  };
}
