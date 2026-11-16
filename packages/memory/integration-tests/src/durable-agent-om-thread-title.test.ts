/**
 * GH #30478: a DurableAgent run treated as an observational-memory run (OM set on the Memory
 * instance and on the call) must title the thread, as the regular Agent does. The OM thresholds
 * sit far above the conversation, so the observer never runs and OM only persists the turn.
 *
 * Real Memory, real OM, real LibSQL store; only the models are local mocks.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, vi } from 'vitest';

const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };

function textModel(modelId: string, text: string, onCall?: () => void) {
  return new MockLanguageModelV2({
    modelId,
    doGenerate: async () => {
      onCall?.();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage,
        content: [{ type: 'text', text }],
        warnings: [],
      };
    },
    doStream: async () => {
      onCall?.();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `r-${modelId}`, modelId, timestamp: new Date(0) },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: text },
          { type: 'text-end', id: 't1' },
          { type: 'finish', finishReason: 'stop', usage },
        ]),
      };
    },
  });
}

describe('DurableAgent observational-memory thread title (#30478)', () => {
  it('titles the thread and keeps the turn messages stored once', async () => {
    let titleCalls = 0;
    const observationalMemory = {
      model: textModel('om-model', 'unused'),
      observation: { messageTokens: 100_000 },
      reflection: { observationTokens: 200_000 },
    };
    const storage = new LibSQLStore({ id: 'durable-om-title', url: ':memory:' });
    const memory = new Memory({
      storage,
      options: {
        generateTitle: { model: textModel('title-model', 'Durable OM title', () => titleCalls++) },
        observationalMemory,
      },
    });
    const base = new Agent({
      id: 'durable-om-title-agent',
      name: 'durable-om-title-agent',
      instructions: 'You are a test agent.',
      model: textModel('main-model', 'Hello from the agent.'),
      memory,
    });
    const agent = createDurableAgent({ agent: base });
    const mastra = new Mastra({ agents: { agent: agent as any }, storage, logger: false });

    const threadId = 'durable-om-title-thread';
    const resourceId = 'durable-om-title-user';
    try {
      const res: any = await mastra.getAgent('agent').stream('Hi, please say hello.', {
        memory: { thread: threadId, resource: resourceId, options: { observationalMemory } },
      } as any);
      await (res.output ?? res).text;
      res.cleanup?.();

      await vi.waitFor(async () => {
        expect((await memory.getThreadById({ threadId }))?.title).toBe('Durable OM title');
      });
      expect(titleCalls).toBe(1);

      const { messages } = await memory.recall({ threadId, resourceId });
      expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
      expect(new Set(messages.map(m => m.id)).size).toBe(messages.length);
    } finally {
      await mastra.stopWorkers?.();
    }
  });
});
