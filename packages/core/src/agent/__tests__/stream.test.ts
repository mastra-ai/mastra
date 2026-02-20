import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { noopLogger } from '../../logger';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { getDummyResponseModel, getEmptyResponseModel, getErrorResponseModel } from './mock-model';

function runStreamTest(version: 'v1' | 'v2' | 'v3') {
  const dummyResponseModel = getDummyResponseModel(version);
  const emptyResponseModel = getEmptyResponseModel(version);
  const errorResponseModel = getErrorResponseModel(version);

  describe(`${version} - stream`, () => {
    it('should persist the full message after a successful run', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyResponseModel,
        memory: mockMemory,
      });

      let stream;
      if (version === 'v1') {
        stream = await agent.streamLegacy('repeat tool calls', {
          threadId: 'thread-1',
          resourceId: 'resource-1',
        });
      } else {
        stream = await agent.stream('repeat tool calls', {
          memory: {
            thread: 'thread-1',
            resource: 'resource-1',
          },
        });
      }

      await stream.consumeStream();

      const result = await mockMemory.recall({ threadId: 'thread-1', resourceId: 'resource-1' });
      const messages = result.messages;
      // Check that the last message matches the expected final output
      expect(
        messages[messages.length - 1]?.content?.parts?.some(
          p => p.type === 'text' && p.text?.includes('Dummy response'),
        ),
      ).toBe(true);
    });

    // Regression test for https://github.com/mastra-ai/mastra/issues/12566
    // stream-legacy creates threads with saveThread: false, causing a race condition
    // where output processors try to save messages before the thread exists in the DB.
    // The fix (from PR #10881 for /stream) is to use saveThread: true so the thread
    // is persisted immediately with proper metadata before output processors run.
    it('should save thread to DB immediately when creating a new thread (Issue #12566)', async () => {
      const mockMemory = new MockMemory();

      // Intercept memory.createThread to track whether saveThread is true or false.
      // With the bug, createThread is called with saveThread: false for new threads,
      // meaning the thread only exists in-memory but not in the DB.
      let createThreadSaveThreadArg: boolean | undefined = undefined;

      const originalCreateThread = mockMemory.createThread.bind(mockMemory);
      mockMemory.createThread = async function (args: any) {
        // Capture the saveThread argument from the first createThread call
        if (createThreadSaveThreadArg === undefined) {
          createThreadSaveThreadArg = args.saveThread;
        }
        return originalCreateThread(args);
      };

      const agent = new Agent({
        id: 'test-agent-12566',
        name: 'Test Agent 12566',
        instructions: 'test',
        model: dummyResponseModel,
        memory: mockMemory,
      });

      agent.__setLogger(noopLogger);

      let stream;
      if (version === 'v1') {
        stream = await agent.streamLegacy('hello', {
          threadId: 'thread-12566',
          resourceId: 'resource-12566',
        });
      } else {
        stream = await agent.stream('hello', {
          memory: {
            thread: 'thread-12566',
            resource: 'resource-12566',
          },
        });
      }

      await stream.consumeStream();

      // createThread must be called with saveThread: true (or default true) so the thread
      // is persisted to the database immediately. With saveThread: false, the thread is
      // only in-memory and storage backends like PostgresStore will reject messages
      // because of foreign key constraints (thread must exist before messages can reference it).
      expect(createThreadSaveThreadArg).not.toBe(false);
    });

    it.skipIf(version === 'v2' || version === 'v3')(
      'should format messages correctly in onStepFinish when provider sends multiple response-metadata chunks (Issue #7050)',
      async () => {
        // This test reproduces the bug where real LLM providers (like OpenRouter)
        // send multiple response-metadata chunks (after each text-delta)
        // which causes the message to have multiple text parts, one for each chunks
        // [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' world' }]
        // instead of properly formatted messages like:
        // [{ role: 'assistant', content: [{ type: 'text', text: 'Hello world' }] }]

        // NOTE: This test is skipped for v2 because it requires format: 'aisdk' which has been removed
        const mockModel = new MockLanguageModelV1({
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            stream: convertArrayToReadableStream([
              { type: 'text-delta', textDelta: 'Hello' },
              { type: 'text-delta', textDelta: ' world' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
              },
            ]),
          }),
        });

        const agent = new Agent({
          id: 'test-agent-7050',
          name: 'Test Agent 7050',
          instructions: 'test',
          model: mockModel,
        });

        let capturedStep: any = null;

        const stream = await agent.streamLegacy('test message', {
          threadId: 'test-thread-7050',
          resourceId: 'test-resource-7050',
          savePerStep: true,
          onStepFinish: async (step: any) => {
            capturedStep = step;
          },
        });

        // Consume the v1 stream (StreamTextResult has textStream property)
        for await (const _chunk of stream.textStream) {
          // Just consume the stream
        }

        // Verify that onStepFinish was called with properly formatted messages
        expect(capturedStep).toBeDefined();
        expect(capturedStep.response).toBeDefined();
        expect(capturedStep.response.messages).toBeDefined();
        expect(Array.isArray(capturedStep.response.messages)).toBe(true);
        expect(capturedStep.response.messages.length).toBeGreaterThan(0);

        // Check that messages have the correct CoreMessage structure
        const firstMessage = capturedStep.response.messages[0];
        expect(firstMessage).toHaveProperty('role');
        expect(firstMessage).toHaveProperty('content');
        expect(typeof firstMessage.role).toBe('string');
        expect(['assistant', 'system', 'user'].includes(firstMessage.role)).toBe(true);
      },
    );

    it('should only call saveMessages for the user message when no assistant parts are generated', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      // @ts-expect-error - accessing private storage for testing
      const original = mockMemory._storage.stores.memory.saveMessages;
      // @ts-expect-error - accessing private storage for testing
      mockMemory._storage.stores.memory.saveMessages = async function (...args) {
        saveCallCount++;
        return original.apply(this, args);
      };

      const agent = new Agent({
        id: 'no-progress-agent',
        name: 'No Progress Agent',
        instructions: 'test',
        model: emptyResponseModel,
        memory: mockMemory,
      });

      let stream;
      if (version === 'v1') {
        stream = await agent.streamLegacy('no progress', {
          threadId: 'thread-2',
          resourceId: 'resource-2',
        });
      } else {
        stream = await agent.stream('no progress', {
          memory: {
            thread: 'thread-2',
            resource: 'resource-2',
          },
        });
      }

      await stream.consumeStream();

      expect(saveCallCount).toBe(1);

      const result = await mockMemory.recall({ threadId: 'thread-2', resourceId: 'resource-2' });
      const messages = result.messages;
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content.content).toBe('no progress');
    });

    it('should not save any message if interrupted before any part is emitted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      // @ts-expect-error - accessing private storage for testing
      const original = mockMemory._storage.stores.memory.saveMessages;
      // @ts-expect-error - accessing private storage for testing
      mockMemory._storage.stores.memory.saveMessages = async function (...args) {
        saveCallCount++;
        return original.apply(this, args);
      };

      const agent = new Agent({
        id: 'immediate-interrupt-agent',
        name: 'Immediate Interrupt Agent',
        instructions: 'test',
        model: errorResponseModel,
        memory: mockMemory,
      });

      let stream;
      if (version === 'v1') {
        stream = await agent.streamLegacy('interrupt before step', {
          threadId: 'thread-3',
          resourceId: 'resource-3',
        });
      } else {
        stream = await agent.stream('interrupt before step', {
          memory: {
            thread: 'thread-3',
            resource: 'resource-3',
          },
        });
      }

      await stream.consumeStream({
        onError: err => {
          expect(err.message).toBe('Immediate interruption');
        },
      });

      // TODO: output processors in v2 still run when the model throws an error! that doesn't seem right.
      // it means in v2 our message history processor saves the input message.
      if (version === `v1`) {
        const result = await mockMemory.recall({ threadId: 'thread-3', resourceId: 'resource-3' });
        const messages = result.messages;
        expect(saveCallCount).toBe(0);
        expect(messages.length).toBe(0);
      }
    });

    it('should save thread but not messages if error occurs during streaming', async () => {
      // v2: Threads are now created upfront to prevent race conditions with storage backends
      // like PostgresStore that validate thread existence before saving messages.
      // When an error occurs during streaming, the thread will exist but no messages
      // will be saved since the response never completed.
      //
      // v1 (legacy): Does not use memory processors, so the old behavior applies where
      // threads are not saved until the request completes successfully.
      const mockMemory = new MockMemory();
      const saveMessagesSpy = vi.spyOn(mockMemory, 'saveMessages');

      let errorModel: MockLanguageModelV1 | MockLanguageModelV2;
      if (version === 'v1') {
        errorModel = new MockLanguageModelV1({
          doStream: async () => {
            const stream = new ReadableStream({
              pull() {
                throw new Error('Simulated stream error');
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });
      } else {
        errorModel = new MockLanguageModelV2({
          doStream: async () => {
            const stream = new ReadableStream({
              pull() {
                throw new Error('Simulated stream error');
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });
      }

      const agent = new Agent({
        id: 'error-agent-stream',
        name: 'Error Agent Stream',
        instructions: 'test',
        model: errorModel,
        memory: mockMemory,
      });

      let errorCaught = false;

      let stream;
      try {
        if (version === 'v1') {
          stream = await agent.streamLegacy('trigger error', {
            memory: {
              resource: 'user-err',
              thread: {
                id: 'thread-err-stream',
              },
            },
          });

          for await (const _ of stream.textStream) {
            // Should throw
          }
        } else {
          stream = await agent.stream('trigger error', {
            memory: {
              resource: 'user-err',
              thread: {
                id: 'thread-err-stream',
              },
            },
          });

          await stream.consumeStream();
          expect(stream.error).toBeDefined();
          expect(stream.error.message).toMatch(/Simulated stream error/);
          errorCaught = true;
        }
      } catch (err: any) {
        errorCaught = true;
        expect(err.message).toMatch(/Simulated stream error/);
      }

      expect(errorCaught).toBe(true);

      const thread = await mockMemory.getThreadById({ threadId: 'thread-err-stream' });

      // Thread should exist (created upfront to prevent race condition with storage
      // backends like PostgresStore that validate thread existence before saving messages).
      // This applies to all versions: v1 was fixed in Issue #12566, v2/v3 in PR #10881.
      expect(thread).not.toBeNull();
      expect(thread?.id).toBe('thread-err-stream');
      // But no messages should be saved since the stream failed
      expect(saveMessagesSpy).not.toHaveBeenCalled();
    });
  });
}

runStreamTest('v1');
runStreamTest('v2');
runStreamTest('v3');
