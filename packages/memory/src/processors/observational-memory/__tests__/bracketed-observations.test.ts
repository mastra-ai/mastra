import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { Memory } from '../../../index';

const observations = [
  '[O1] - Ticket [T-123] belongs to [alice].',
  '[O2] - [U4 Alice] said the deployment is ready; [U5 Bob] approved.',
  '  [O2-N1] - Read [deployment guide](https://example.com/deploy).',
  '[O3] - [72 items collapsed - ID: b1fa]',
].join('\n');

describe('bracketed observation facts', () => {
  it.each([false, true])('preserves facts in model input without changing storage (readOnly=%s)', async readOnly => {
    const store = new InMemoryStore();
    const memory = new Memory({
      storage: store,
      options: {
        lastMessages: 0,
        observationalMemory: {
          scope: 'thread',
          observation: { model: 'openai/gpt-4o-mini', messageTokens: 100_000, bufferTokens: false },
          reflection: { observationTokens: 100_000 },
        },
      },
    });
    const threadId = 'bracketed-observations-thread';
    const resourceId = 'bracketed-observations-resource';
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Bracketed observations',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const storage = await store.getStore('memory');
    if (!storage) throw new Error('Missing memory store');
    const record = await storage.initializeObservationalMemory({ threadId, resourceId, scope: 'thread', config: {} });
    await storage.updateActiveObservations({
      id: record.id,
      observations,
      tokenCount: 100,
      lastObservedAt: new Date(),
    });
    const before = await storage.getObservationalMemory(threadId, resourceId);
    const prompts: { role: string; content: unknown }[][] = [];
    const agent = new Agent({
      id: 'bracketed-observations-agent',
      name: 'Bracketed observations agent',
      instructions: 'Help the user.',
      memory,
      model: new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          prompts.push(prompt);
          return {
            content: [{ type: 'text', text: 'Noted.' }],
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 2, totalTokens: 102 },
            warnings: [],
          };
        },
      }),
    });
    await agent.generate('Who owns the ticket?', {
      memory: { thread: threadId, resource: resourceId, options: { readOnly } },
    });
    expect(prompts).toHaveLength(1);
    const systems = prompts[0]!.filter(message => message.role === 'system');
    const text = systems.map(message => message.content).join('\n');
    expect(text).toContain('<observations>');
    expect(text).toContain('Ticket [T-123] belongs to [alice].');
    expect(text).toContain('[U4 Alice] said the deployment is ready; [U5 Bob] approved.');
    expect(text).toContain('[deployment guide](https://example.com/deploy)');
    expect(text).toContain('[72 items collapsed - ID: b1fa]');
    expect(text).not.toMatch(/\[O\d+(?:-N\d+)?\]/);
    expect(await storage.getObservationalMemory(threadId, resourceId)).toEqual(before);
    expect(before?.activeObservations).toBe(observations);
  });
});
