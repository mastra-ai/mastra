import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { noopLogger } from '../../logger';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
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

// --- Tool-result JSON leak tests (#13268) ---
// Some models (observed with gpt-oss-120b via OpenRouter) echo the JSON result
// of a previous tool call as text-delta chunks in the next LLM step. This causes
// raw JSON like {"priority":"critical","recommendation":"upgrade immediately"}
// to appear in the chat UI as visible text.

const TOOL_RESULT = {
  priority: 'critical',
  recommendation: 'upgrade immediately',
  affectedVersions: ['1.0.0', '1.1.0'],
};

const TOOL_RESULT_JSON = JSON.stringify(TOOL_RESULT);

const FINAL_ANSWER = 'The defect is critical. You should upgrade immediately to version 1.2.0.';

const classifyDefectTool = createTool({
  id: 'classifyDefect',
  description: 'Classifies a defect and returns priority and recommendation',
  inputSchema: z.object({
    description: z.string(),
  }),
  execute: async () => TOOL_RESULT,
});

/**
 * Creates a MockLanguageModelV2 that simulates the bug from #13268:
 * - Step 1: model makes a tool call (classifyDefect)
 * - Step 2: model echoes the tool result JSON as text-delta, then gives the real answer
 *
 * The `echoStyle` parameter controls how the model echoes the tool result:
 * - 'before-answer': JSON appears as text before the actual answer text
 * - 'standalone': JSON is the only text in an intermediate step, followed by another tool call
 */
function createLeakyModel(echoStyle: 'before-answer' | 'standalone' = 'before-answer') {
  let callCount = 0;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;

      if (echoStyle === 'before-answer') {
        if (callCount === 1) {
          return {
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName: 'classifyDefect',
                args: { description: 'system crash on startup' },
                input: '{"description":"system crash on startup"}',
              },
            ],
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
            warnings: [],
            response: { id: 'resp-1', modelId: 'mock-leaky-model' },
          };
        } else {
          // Step 2: model echoes tool result JSON + real answer
          return {
            content: [{ type: 'text' as const, text: TOOL_RESULT_JSON + '\n' + FINAL_ANSWER }],
            finishReason: 'stop' as const,
            usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
            warnings: [],
            response: { id: 'resp-2', modelId: 'mock-leaky-model' },
          };
        }
      }

      // 'standalone' style: 3 steps
      if (callCount === 1) {
        return {
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName: 'classifyDefect',
              args: { description: 'system crash on startup' },
              input: '{"description":"system crash on startup"}',
            },
          ],
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
          warnings: [],
          response: { id: 'resp-1', modelId: 'mock-leaky-model' },
        };
      } else if (callCount === 2) {
        // Model echoes tool result as text AND makes another tool call
        return {
          content: [
            { type: 'text' as const, text: TOOL_RESULT_JSON },
            {
              type: 'tool-call' as const,
              toolCallId: 'call-2',
              toolName: 'classifyDefect',
              args: { description: 'follow-up check' },
              input: '{"description":"follow-up check"}',
            },
          ],
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 20, outputTokens: 25, totalTokens: 45 },
          warnings: [],
          response: { id: 'resp-2', modelId: 'mock-leaky-model' },
        };
      } else {
        return {
          content: [{ type: 'text' as const, text: FINAL_ANSWER }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 30, outputTokens: 20, totalTokens: 50 },
          warnings: [],
          response: { id: 'resp-3', modelId: 'mock-leaky-model' },
        };
      }
    },

    doStream: async () => {
      callCount++;

      if (echoStyle === 'before-answer') {
        if (callCount === 1) {
          // Step 1: tool call only
          return {
            stream: convertArrayToReadableStream([
              { type: 'response-metadata', id: 'resp-1', modelId: 'mock-leaky-model' },
              { type: 'tool-input-start', id: 'call-1', toolName: 'classifyDefect' },
              { type: 'tool-input-delta', id: 'call-1', delta: '{"description":"system crash on startup"}' },
              { type: 'tool-input-end', id: 'call-1' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'classifyDefect',
                input: '{"description":"system crash on startup"}',
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
              },
            ]),
          };
        } else {
          // Step 2: leaked JSON as text-delta THEN real answer
          return {
            stream: convertArrayToReadableStream([
              { type: 'response-metadata', id: 'resp-2', modelId: 'mock-leaky-model' },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: TOOL_RESULT_JSON },
              { type: 'text-delta', id: 'text-1', delta: '\n' },
              { type: 'text-delta', id: 'text-1', delta: FINAL_ANSWER },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 } },
            ]),
          };
        }
      }

      // 'standalone' style: 3 steps
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock-leaky-model' },
            { type: 'tool-input-start', id: 'call-1', toolName: 'classifyDefect' },
            { type: 'tool-input-delta', id: 'call-1', delta: '{"description":"system crash on startup"}' },
            { type: 'tool-input-end', id: 'call-1' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'classifyDefect',
              input: '{"description":"system crash on startup"}',
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
            },
          ]),
        };
      } else if (callCount === 2) {
        // Step 2: leaked JSON as text + another tool call
        return {
          stream: convertArrayToReadableStream([
            { type: 'response-metadata', id: 'resp-2', modelId: 'mock-leaky-model' },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: TOOL_RESULT_JSON },
            { type: 'text-end', id: 'text-1' },
            { type: 'tool-input-start', id: 'call-2', toolName: 'classifyDefect' },
            { type: 'tool-input-delta', id: 'call-2', delta: '{"description":"follow-up check"}' },
            { type: 'tool-input-end', id: 'call-2' },
            {
              type: 'tool-call',
              toolCallId: 'call-2',
              toolName: 'classifyDefect',
              input: '{"description":"follow-up check"}',
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 20, outputTokens: 25, totalTokens: 45 },
            },
          ]),
        };
      } else {
        return {
          stream: convertArrayToReadableStream([
            { type: 'response-metadata', id: 'resp-3', modelId: 'mock-leaky-model' },
            { type: 'text-start', id: 'text-2' },
            { type: 'text-delta', id: 'text-2', delta: FINAL_ANSWER },
            { type: 'text-end', id: 'text-2' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 30, outputTokens: 20, totalTokens: 50 } },
          ]),
        };
      }
    },
  });
}

describe('tool-result JSON leak (#13268)', () => {
  describe('stream() - textStream', () => {
    it('should not contain leaked tool-result JSON when model echoes it before the answer', async () => {
      const agent = new Agent({
        id: 'leak-test-agent',
        name: 'Leak Test Agent',
        instructions: 'Classify defects using the classifyDefect tool.',
        model: createLeakyModel('before-answer'),
        tools: { classifyDefect: classifyDefectTool },
      });

      const result = await agent.stream('Classify this defect: system crash on startup');

      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      // The leaked JSON should NOT appear in textStream
      expect(fullText).not.toContain(TOOL_RESULT_JSON);
      // The actual answer should still be there
      expect(fullText).toContain(FINAL_ANSWER);
    });

    it('should not contain leaked tool-result JSON in 3-step standalone echo scenario', async () => {
      const agent = new Agent({
        id: 'leak-test-agent-standalone',
        name: 'Leak Test Agent',
        instructions: 'Classify defects using the classifyDefect tool.',
        model: createLeakyModel('standalone'),
        tools: { classifyDefect: classifyDefectTool },
      });

      const result = await agent.stream('Classify this defect: system crash on startup');

      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      // The leaked JSON should NOT appear in textStream
      expect(fullText).not.toContain(TOOL_RESULT_JSON);
      // The actual answer should still be there
      expect(fullText).toContain(FINAL_ANSWER);
    });
  });

  describe('stream() - fullStream', () => {
    it('should not emit text-delta chunks containing leaked tool-result JSON', async () => {
      const agent = new Agent({
        id: 'leak-test-agent-fullstream',
        name: 'Leak Test Agent',
        instructions: 'Classify defects using the classifyDefect tool.',
        model: createLeakyModel('before-answer'),
        tools: { classifyDefect: classifyDefectTool },
      });

      const result = await agent.stream('Classify this defect: system crash on startup');

      const textDeltas: string[] = [];
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          textDeltas.push(chunk.payload.text);
        }
      }

      const joinedText = textDeltas.join('');
      // Leaked JSON should NOT appear in any text-delta chunks
      expect(joinedText).not.toContain(TOOL_RESULT_JSON);
      // Real answer should be present
      expect(joinedText).toContain(FINAL_ANSWER);
    });
  });

  describe('generate()', () => {
    it('should not contain leaked tool-result JSON in the final text', async () => {
      const agent = new Agent({
        id: 'leak-test-agent-generate',
        name: 'Leak Test Agent',
        instructions: 'Classify defects using the classifyDefect tool.',
        model: createLeakyModel('before-answer'),
        tools: { classifyDefect: classifyDefectTool },
      });

      const result = await agent.generate('Classify this defect: system crash on startup');

      // The leaked JSON should NOT appear in result.text
      expect(result.text).not.toContain(TOOL_RESULT_JSON);
      // The actual answer should still be there
      expect(result.text).toContain(FINAL_ANSWER);
    });

    it('should not contain leaked tool-result JSON in 3-step standalone scenario', async () => {
      const agent = new Agent({
        id: 'leak-test-agent-generate-standalone',
        name: 'Leak Test Agent',
        instructions: 'Classify defects using the classifyDefect tool.',
        model: createLeakyModel('standalone'),
        tools: { classifyDefect: classifyDefectTool },
      });

      const result = await agent.generate('Classify this defect: system crash on startup');

      // The leaked JSON should NOT appear in result.text
      expect(result.text).not.toContain(TOOL_RESULT_JSON);
      // The actual answer should still be there
      expect(result.text).toContain(FINAL_ANSWER);
    });
  });

  describe('stream() - step isolation', () => {
    it('should have correct step results with tool calls isolated per step', async () => {
      const agent = new Agent({
        id: 'leak-test-agent-steps',
        name: 'Leak Test Agent',
        instructions: 'Classify defects using the classifyDefect tool.',
        model: createLeakyModel('before-answer'),
        tools: { classifyDefect: classifyDefectTool },
      });

      const result = await agent.stream('Classify this defect: system crash on startup');

      const steps: Array<{ text: string; toolCalls: string[]; finishReason: string }> = [];

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'step-finish') {
          steps.push({
            text: chunk.payload.output?.text ?? '',
            toolCalls: (chunk.payload.output?.toolCalls ?? []).map((tc: any) => tc.toolName),
            finishReason: chunk.payload.stepResult?.reason ?? '',
          });
        }
      }

      expect(steps.length).toBe(2);

      // Step 1: tool call step
      expect(steps[0]!.toolCalls).toContain('classifyDefect');
      expect(steps[0]!.finishReason).toBe('tool-calls');

      // Step 2: text answer step — should NOT contain leaked JSON
      expect(steps[1]!.text).not.toContain(TOOL_RESULT_JSON);
      expect(steps[1]!.text).toContain(FINAL_ANSWER);
      expect(steps[1]!.finishReason).toBe('stop');
    });
  });
});
