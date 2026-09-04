import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { MastraError } from '../error';
import { MockMemory } from '../memory/mock';
import { Agent } from './index';

describe('thread/resource ownership enforcement', () => {
  let memory: MockMemory;
  let modelCalls: number;
  let agent: Agent;

  const threadId = 'shared-thread-id';

  beforeEach(() => {
    memory = new MockMemory();
    modelCalls = 0;

    const model = new MockLanguageModelV2({
      doStream: async () => {
        modelCalls += 1;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'ok' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
      doGenerate: async () => {
        modelCalls += 1;
        return {
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text: 'ok' }],
          warnings: [],
        };
      },
    });

    agent = new Agent({
      id: 'ownership-agent',
      name: 'Ownership Agent',
      instructions: 'Reply briefly.',
      model,
      memory,
    });
  });

  async function drain(result: any) {
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'error') throw chunk.error;
    }
  }

  it('allows the owning resource to reuse an existing thread', async () => {
    await drain(await agent.stream('first', { memory: { thread: threadId, resource: 'resource-a' } }));
    await drain(await agent.stream('second', { memory: { thread: threadId, resource: 'resource-a' } }));

    expect(modelCalls).toBe(2);
    expect((await memory.getThreadById({ threadId }))?.resourceId).toBe('resource-a');
  });

  it('rejects stream() for a thread owned by a different resource before calling the model', async () => {
    await drain(await agent.stream('first', { memory: { thread: threadId, resource: 'resource-a' } }));
    expect(modelCalls).toBe(1);

    await expect(
      (async () =>
        drain(await agent.stream('must not run', { memory: { thread: threadId, resource: 'resource-b' } })))(),
    ).rejects.toThrow(/belongs to resource "resource-a"/);

    expect(modelCalls).toBe(1);
    expect((await memory.getThreadById({ threadId }))?.resourceId).toBe('resource-a');
  });

  it('rejects generate() for a thread owned by a different resource', async () => {
    await agent.generate('first', { memory: { thread: threadId, resource: 'resource-a' } });
    expect(modelCalls).toBe(1);

    await expect(
      agent.generate('must not run', { memory: { thread: threadId, resource: 'resource-b' } }),
    ).rejects.toThrow(/belongs to resource "resource-a"/);

    expect(modelCalls).toBe(1);
  });

  it('throws a stable MastraError id and does not mutate thread metadata', async () => {
    await agent.generate('first', {
      memory: { thread: { id: threadId, metadata: { owner: 'a' } }, resource: 'resource-a' },
    });

    let caught: unknown;
    try {
      await agent.generate('must not run', {
        memory: { thread: { id: threadId, metadata: { owner: 'b' } }, resource: 'resource-b' },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MastraError);
    expect((caught as MastraError).message).toMatch(/belongs to resource "resource-a"/);

    const thread = await memory.getThreadById({ threadId });
    expect(thread?.resourceId).toBe('resource-a');
    expect(thread?.metadata?.owner).toBe('a');
  });

  it('allows threads stored without a resourceId (legacy rows)', async () => {
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId: '',
        title: '',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await agent.generate('ok', { memory: { thread: threadId, resource: 'resource-a' } });
    expect(modelCalls).toBe(1);
  });
});
