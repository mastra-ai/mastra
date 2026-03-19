import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';

function memoryMetadataTests(version: 'v1' | 'v2') {
  describe(`${version} - agent memory with metadata`, () => {
    let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;
    beforeEach(() => {
      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `Dummy response`,
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [{ type: 'text-delta', textDelta: 'dummy' }],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: `Dummy response`,
            content: [
              {
                type: 'text',
                text: 'Dummy response',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          }),
        });
      }
    });

    it.skipIf(version !== 'v2')(
      'should persist modelId in assistant message content.metadata using stream',
      async () => {
        const mockMemory = new MockMemory();
        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'test',
          model: dummyModel,
          memory: mockMemory,
        });

        const res = await agent.stream('hello', {
          memory: {
            resource: 'user-1',
            thread: { id: 'thread-model-stream' },
          },
        });

        await res.consumeStream();

        const { messages } = await mockMemory.recall({
          threadId: 'thread-model-stream',
          perPage: false,
        });
        const assistantMessages = messages.filter(m => m.role === 'assistant');
        expect(assistantMessages.length).toBeGreaterThan(0);

        for (const msg of assistantMessages) {
          expect(msg.content.metadata?.modelId).toBe('mock-model-id');
        }
      },
    );

    it('should create a new thread with metadata using generate', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generateLegacy('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'test' },
            },
          },
        });
      } else {
        await agent.generate('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'test' },
            },
          },
        });
      }

      const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
      expect(thread).toBeDefined();
      expect(thread?.metadata).toEqual({ client: 'test' });
      expect(thread?.resourceId).toBe('user-1');
    });

    it('should update metadata for an existing thread using generate', async () => {
      const mockMemory = new MockMemory();
      const initialThread: StorageThreadType = {
        id: 'thread-1',
        resourceId: 'user-1',
        metadata: { client: 'initial' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await mockMemory.saveThread({ thread: initialThread });

      const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generateLegacy('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'updated' },
            },
          },
        });
      } else {
        await agent.generate('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'updated' },
            },
          },
        });
      }

      expect(saveThreadSpy).toHaveBeenCalledTimes(1);
      const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata).toEqual({ client: 'updated' });
    });

    it('should not update metadata if it is the same using generate', async () => {
      const mockMemory = new MockMemory();
      const initialThread: StorageThreadType = {
        id: 'thread-1',
        resourceId: 'user-1',
        metadata: { client: 'same' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await mockMemory.saveThread({ thread: initialThread });

      const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generateLegacy('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'same' },
            },
          },
        });
      } else {
        await agent.generate('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'same' },
            },
          },
        });
      }

      expect(saveThreadSpy).not.toHaveBeenCalled();
    });

    it('should create a new thread with metadata using stream', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      let res;
      if (version === 'v1') {
        res = await agent.streamLegacy('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'test-stream' },
            },
          },
        });
      } else {
        res = await agent.stream('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'test-stream' },
            },
          },
        });
      }

      await res.consumeStream();

      const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
      expect(thread).toBeDefined();
      expect(thread?.metadata).toEqual({ client: 'test-stream' });
      expect(thread?.resourceId).toBe('user-1');
    });

    it.skipIf(version !== 'v1')(
      'generate - should still work with deprecated threadId and resourceId (legacy only)',
      async () => {
        const mockMemory = new MockMemory();
        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'test',
          model: dummyModel,
          memory: mockMemory,
        });

        await agent.generateLegacy('hello', {
          resourceId: 'user-1',
          threadId: 'thread-1',
        });

        const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
        expect(thread).toBeDefined();
        expect(thread?.id).toBe('thread-1');
        expect(thread?.resourceId).toBe('user-1');
      },
    );

    it.skipIf(version !== 'v1')(
      'stream - should still work with deprecated threadId and resourceId (legacy only)',
      async () => {
        const mockMemory = new MockMemory();
        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'test',
          model: dummyModel,
          memory: mockMemory,
        });

        const stream = await agent.streamLegacy('hello', {
          resourceId: 'user-1',
          threadId: 'thread-1',
        });

        await stream.consumeStream();

        const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
        expect(thread).toBeDefined();
        expect(thread?.id).toBe('thread-1');
        expect(thread?.resourceId).toBe('user-1');
      },
    );
  });
}

memoryMetadataTests('v1');
memoryMetadataTests('v2');
