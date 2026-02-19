import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV5 } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils-v5';
import type { LanguageModelV1 } from '@internal/ai-sdk-v4';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { noopLogger } from '../../logger';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { assertNoDuplicateParts } from '../test-utils';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openai_v5 = createOpenAIV5({ apiKey: process.env.OPENAI_API_KEY });

function saveAndErrorE2ETests(version: 'v1' | 'v2') {
  let openaiModel: LanguageModelV1 | LanguageModelV2;

  beforeEach(() => {
    if (version === 'v1') {
      openaiModel = openai('gpt-4o');
    } else {
      openaiModel = openai_v5('gpt-4o');
    }
  });

  describe(`${version} - Agent save message parts`, () => {
    describe('generate', () => {
      // Processors need prepareStep and onStepFinish to be able to have MessageHistory processor save partial messages. Or we need message list in processOutputStream
      it.skip('should rescue partial messages (including tool calls) if generate is aborted/interrupted', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;
        let savedMessages: any[] = [];
        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          savedMessages.push(...args[0].messages);
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const errorTool = createTool({
          id: 'errorTool',
          description: 'Always throws an error.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async () => {
            throw new Error('Tool failed!');
          },
        });

        const echoTool = createTool({
          id: 'echoTool',
          description: 'Echoes the input string.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async input => ({ output: input.input }),
        });

        const agent = new Agent({
          id: 'partial-rescue-agent-generate',
          name: 'Partial Rescue Agent Generate',
          instructions:
            'Call each tool in a separate step. Do not use parallel tool calls. Always wait for the result of one tool before calling the next.',
          model: openaiModel,
          memory: mockMemory,
          tools: { errorTool, echoTool },
        });
        agent.__setLogger(noopLogger);

        let stepCount = 0;
        let caught = false;
        try {
          if (version === 'v1') {
            await agent.generateLegacy(
              'Please echo this and then use the error tool. Be verbose and take multiple steps.',
              {
                threadId: 'thread-partial-rescue-generate',
                resourceId: 'resource-partial-rescue-generate',
                experimental_continueSteps: true,
                savePerStep: true,
                onStepFinish: (result: any) => {
                  if (result.toolCalls && result.toolCalls.length > 1) {
                    throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
                  }
                  stepCount++;
                  if (stepCount === 2) {
                    throw new Error('Simulated error in onStepFinish');
                  }
                },
              },
            );
          } else {
            await agent.generate('Please echo this and then use the error tool. Be verbose and take multiple steps.', {
              memory: {
                thread: 'thread-partial-rescue-generate',
                resource: 'resource-partial-rescue-generate',
              },
              savePerStep: true,
              onStepFinish: (result: any) => {
                if (result.toolCalls && result.toolCalls.length > 1) {
                  throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
                }
                stepCount++;
                if (stepCount === 2) {
                  throw new Error('Simulated error in onStepFinish');
                }
              },
            });
          }
        } catch (err: any) {
          caught = true;
          expect(err.message).toMatch(/Simulated error in onStepFinish/i);
        }

        expect(caught).toBe(true);

        // After interruption, check what was saved
        const result = await mockMemory.recall({
          threadId: 'thread-partial-rescue-generate',
          resourceId: 'resource-partial-rescue-generate',
        });
        const messages = result.messages;

        // User message should be saved
        expect(messages.find(m => m.role === 'user')).toBeTruthy();
        // At least one assistant message (could be partial) should be saved
        expect(messages.find(m => m.role === 'assistant')).toBeTruthy();
        // At least one tool call (echoTool or errorTool) should be saved if the model got that far
        const assistantWithToolInvocation = messages.find(
          m =>
            m.role === 'assistant' &&
            m.content &&
            Array.isArray(m.content.parts) &&
            m.content.parts.some(
              part =>
                part.type === 'tool-invocation' &&
                part.toolInvocation &&
                (part.toolInvocation.toolName === 'echoTool' || part.toolInvocation.toolName === 'errorTool'),
            ),
        );
        expect(assistantWithToolInvocation).toBeTruthy();
        // There should be at least one save call (user and partial assistant/tool)
        expect(saveCallCount).toBeGreaterThanOrEqual(1);
      });

      // Processors need prepareStep and onStepFinish to be able to have MessageHistory processor save partial messages. Or we need message list in processOutputStream
      it.skip('should incrementally save messages across steps and tool calls', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;
        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const echoTool = createTool({
          id: 'echoTool',
          description: 'Echoes the input string.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async input => ({ output: input.input }),
        });

        const agent = new Agent({
          id: 'test-agent-generate',
          name: 'Test Agent Generate',
          instructions: 'If the user prompt contains "Echo:", always call the echoTool. Be verbose in your response.',
          model: openaiModel,
          memory: mockMemory,
          tools: { echoTool },
        });

        if (version === 'v1') {
          await agent.generateLegacy('Echo: Please echo this long message and explain why.', {
            threadId: 'thread-echo-generate',
            resourceId: 'resource-echo-generate',
            savePerStep: true,
          });
        } else {
          await agent.generate('Echo: Please echo this long message and explain why.', {
            memory: {
              thread: 'thread-echo-generate',
              resource: 'resource-echo-generate',
            },
            savePerStep: true,
          });
        }

        expect(saveCallCount).toBeGreaterThan(1);
        const result = await mockMemory.recall({
          threadId: 'thread-echo-generate',
          resourceId: 'resource-echo-generate',
        });
        const messages = result.messages;
        expect(messages.length).toBeGreaterThan(0);

        const assistantMsg = messages.find(m => m.role === 'assistant');
        expect(assistantMsg).toBeDefined();
        assertNoDuplicateParts(assistantMsg!.content.parts);

        const toolResultIds = new Set(
          assistantMsg!.content.parts
            .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
            .map(p => (p as ToolInvocationUIPart).toolInvocation.toolCallId),
        );
        expect(assistantMsg!.content.toolInvocations?.length).toBe(toolResultIds.size);
      }, 500000);

      // Processors need prepareStep and onStepFinish to be able to have MessageHistory processor save partial messages. Or we need message list in processOutputStream
      it.skip('should incrementally save messages with multiple tools and multi-step generation', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;
        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const echoTool = createTool({
          id: 'echoTool',
          description: 'Echoes the input string.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async input => ({ output: input.input }),
        });

        const uppercaseTool = createTool({
          id: 'uppercaseTool',
          description: 'Converts input to uppercase.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async input => ({ output: input.input.toUpperCase() }),
        });

        const agent = new Agent({
          id: 'test-agent-multi-generate',
          name: 'Test Agent Multi Generate',
          instructions: [
            'If the user prompt contains "Echo:", call the echoTool.',
            'If the user prompt contains "Uppercase:", call the uppercaseTool.',
            'If both are present, call both tools and explain the results.',
            'Be verbose in your response.',
          ].join(' '),
          model: openaiModel,
          memory: mockMemory,
          tools: { echoTool, uppercaseTool },
        });

        if (version === 'v1') {
          await agent.generateLegacy(
            'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
            {
              threadId: 'thread-multi-generate',
              resourceId: 'resource-multi-generate',
              savePerStep: true,
            },
          );
        } else {
          await agent.generate(
            'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
            {
              memory: {
                thread: 'thread-multi-generate',
                resource: 'resource-multi-generate',
              },
              savePerStep: true,
            },
          );
        }
        expect(saveCallCount).toBeGreaterThan(1);
        const result = await mockMemory.recall({
          threadId: 'thread-multi-generate',
          resourceId: 'resource-multi-generate',
        });
        const messages = result.messages;
        expect(messages.length).toBeGreaterThan(0);
        const assistantMsg = messages.find(m => m.role === 'assistant');
        expect(assistantMsg).toBeDefined();
        assertNoDuplicateParts(assistantMsg!.content.parts);

        const toolResultIds = new Set(
          assistantMsg!.content.parts
            .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
            .map(p => (p as ToolInvocationUIPart).toolInvocation.toolCallId),
        );
        expect(assistantMsg!.content.toolInvocations?.length).toBe(toolResultIds.size);
      }, 500000);
    }, 500000);
  });
}

saveAndErrorE2ETests('v1');
saveAndErrorE2ETests('v2');

describe('stream destructuring support', () => {
  it('should support destructuring of stream properties and methods', async () => {
    const agent = new Agent({
      id: 'test-destructuring',
      name: 'Test Destructuring',
      model: openai_v5('gpt-4o'),
      instructions: 'You are a helpful assistant.',
    });

    const result = await agent.stream('Say hello');

    // Test destructuring of various properties
    const { fullStream, textStream, text, usage, consumeStream, toolCalls, finishReason, request } = result;

    // These should all work without throwing errors
    try {
      // Test async method
      await consumeStream();

      // Test promise getters
      const textResult = await text;
      expect(typeof textResult).toBe('string');

      const usageResult = await usage;
      expect(usageResult).toBeDefined();

      const toolCallsResult = await toolCalls;
      expect(Array.isArray(toolCallsResult)).toBe(true);

      const finishReasonResult = await finishReason;
      expect(finishReasonResult).toBeDefined();

      const requestResult = await request;
      expect(requestResult).toBeDefined();

      // Test stream getters (just check they exist without consuming)
      expect(fullStream).toBeDefined();
      expect(textStream).toBeDefined();
    } catch (error) {
      // If this fails before the fix, we expect it to throw
      console.error('Destructuring test failed:', error);
      throw error;
    }
  });
});
