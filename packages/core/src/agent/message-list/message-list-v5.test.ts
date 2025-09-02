import type { CoreMessage as AIV4CoreMessage, UIMessage as AIV4UIMessage } from 'ai';
import { isToolUIPart } from 'ai-v5';
import type { ModelMessage as AIV5ModelMessage, UIMessage as AIV5UIMessage } from 'ai-v5';
import { describe, expect, it } from 'vitest';
import { hasAIV5CoreMessageCharacteristics } from './utils/ai-v4-v5/core-model-message';
import { hasAIV5UIMessageCharacteristics } from './utils/ai-v4-v5/ui-message';
import type { MastraMessageV2 } from './index';
import { MessageList } from './index';

const threadId = 'test-thread';
const resourceId = 'test-resource';

describe('MessageList V5 Support', () => {
  describe('V4/V5 Detection', () => {
    describe('hasAIV5CoreMessageCharacteristics', () => {
      it('should detect v5 messages with output in tool-result parts', () => {
        const v5Message: AIV5ModelMessage = {
          role: 'assistant',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'example',
              output: { type: 'text', value: 'success' }, // v5 uses output
            },
          ],
        };

        expect(hasAIV5CoreMessageCharacteristics(v5Message)).toBe(true);
      });

      it('should detect v4 messages with result in tool-result parts', () => {
        const v4Message: AIV4CoreMessage = {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'test',
              toolCallId: 'call-1',
              result: { data: 'success' }, // v4 uses result
            },
          ],
        };

        expect(hasAIV5CoreMessageCharacteristics(v4Message)).toBe(false);
      });

      it('should detect v5 messages with input in tool-call parts', () => {
        const v5Message: AIV5ModelMessage = {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              input: { param: 'value' }, // v5 uses input
              toolName: 'test-tool',
            },
          ],
        };

        expect(hasAIV5CoreMessageCharacteristics(v5Message)).toBe(true);
      });

      it('should detect v4 messages with args in tool-call parts', () => {
        const v4Message: AIV4CoreMessage = {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              args: { param: 'value' }, // v4 uses args
              toolName: 'test-tool',
            },
          ],
        };

        expect(hasAIV5CoreMessageCharacteristics(v4Message)).toBe(false);
      });

      it('should detect v5 messages with mediaType in file parts', () => {
        const v5Message: AIV5ModelMessage = {
          role: 'user',
          content: [
            {
              type: 'file',
              data: 'base64data',
              mediaType: 'image/png', // v5 uses mediaType
            },
          ],
        };

        expect(hasAIV5CoreMessageCharacteristics(v5Message)).toBe(true);
      });

      it('should detect v4 messages with mimeType in file parts', () => {
        const v4Message: AIV4CoreMessage = {
          role: 'user',
          content: [
            {
              type: 'file',
              data: 'base64data',
              mimeType: 'image/png', // v4 uses mimeType
            },
          ],
        };

        expect(hasAIV5CoreMessageCharacteristics(v4Message)).toBe(false);
      });

      it('should detect v4 messages with experimental_providerMetadata', () => {
        const v4Message: AIV4CoreMessage = {
          role: 'assistant',
          content: 'Hello',
          experimental_providerMetadata: { custom: { stuff: 'data' } }, // v4-only property
        };

        expect(hasAIV5CoreMessageCharacteristics(v4Message)).toBe(false);
      });

      it('should detect v4 messages with redacted-reasoning type', () => {
        const v4Message: AIV4CoreMessage = {
          role: 'assistant',
          content: [
            {
              type: 'redacted-reasoning', // v4-only type
              data: 'redacted',
            },
          ],
        };

        expect(hasAIV5CoreMessageCharacteristics(v4Message)).toBe(false);
      });

      it('should treat identical messages as v5-compatible', () => {
        const identicalMessage: AIV4CoreMessage | AIV5ModelMessage = {
          role: 'user',
          content: 'Hello world', // string content is identical in both
        };

        // Should return true because the format is identical
        expect(hasAIV5CoreMessageCharacteristics(identicalMessage)).toBe(true);
      });

      it('should treat messages with no distinguishing features as v5-compatible', () => {
        const simpleMessage: AIV4CoreMessage | AIV5ModelMessage = {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Simple text message',
            },
          ],
        };

        // Should return true because no v4-specific features found
        expect(hasAIV5CoreMessageCharacteristics(simpleMessage)).toBe(true);
      });
    });

    describe('hasAIV5UIMessageCharacteristics', () => {
      it('should detect v4 messages with toolInvocations array', () => {
        const v4Message = {
          id: 'msg-1',
          role: 'assistant',
          content: 'Processing...',
          parts: [],
          toolInvocations: [
            {
              toolCallId: 'call-1',
              toolName: 'test-tool',
              args: { param: 'value' },
              state: 'result',
              result: { data: 'success' },
            },
          ],
        } satisfies AIV4UIMessage;

        expect(hasAIV5UIMessageCharacteristics(v4Message)).toBe(false);
      });

      it('should detect v5 messages with tool parts having tool-${toolName} format', () => {
        const v5Message: AIV5UIMessage = {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-test-tool', // v5 format
              toolCallId: 'call-1',
              input: { param: 'value' },
              state: 'output-available',
              output: { data: 'success' },
            },
          ],
        };

        expect(hasAIV5UIMessageCharacteristics(v5Message)).toBe(true);
      });

      it('should detect v4 messages with tool-invocation type', () => {
        const v4Message: AIV4UIMessage = {
          id: 'msg-1',
          role: 'assistant',
          content: '',
          parts: [
            {
              type: 'text',
              text: 'Calling tool...',
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-1',
                toolName: 'test-tool',
                args: { param: 'value' },
                state: 'result',
                result: { data: 'success' },
              },
            },
          ],
        };

        expect(hasAIV5UIMessageCharacteristics(v4Message)).toBe(false);
      });

      it('should detect v5 messages with source-url type', () => {
        const v5Message: AIV5UIMessage = {
          id: 'msg-1',
          role: 'user',
          parts: [
            {
              type: 'source-url', // v5 type
              sourceId: '1',
              url: 'https://example.com',
            },
          ],
        };

        expect(hasAIV5UIMessageCharacteristics(v5Message)).toBe(true);
      });

      it('should detect v4 messages with source type', () => {
        const v4Message: AIV4UIMessage = {
          id: 'msg-1',
          role: 'user',
          content: '',
          parts: [
            {
              type: 'source', // v4 type
              source: {
                url: 'https://example.com',
                sourceType: 'url',
                id: '1',
                providerMetadata: { custom: { stuff: 'ok' } },
              },
            },
          ],
        };

        expect(hasAIV5UIMessageCharacteristics(v4Message)).toBe(false);
      });
    });
  });

  describe('Message Conversion', () => {
    describe('V3 to V5 UI Message conversion', () => {
      it('should convert text parts correctly', () => {
        const list = new MessageList({ threadId, resourceId });
        list.add('Hello from user', 'input');

        const v5Messages = list.get.all.aiV5.ui();
        expect(v5Messages).toHaveLength(1);
        expect(v5Messages[0].role).toBe('user');

        // Find the text part (there may be additional parts like step-start)
        const textPart = v5Messages[0].parts.find(p => p.type === 'text');
        expect(textPart).toMatchObject({
          type: 'text',
          text: 'Hello from user',
        });
      });

      it('should convert tool invocations with pending state', () => {
        const list = new MessageList({ threadId, resourceId });
        const v2Message: MastraMessageV2 = {
          id: 'msg-1',
          role: 'assistant',
          createdAt: new Date(),
          threadId,
          resourceId,
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  toolCallId: 'call-1',
                  toolName: 'test-tool',
                  step: 1,
                  state: 'call',
                  args: { param: 'value' },
                },
              },
            ],
          },
        };

        list.add(v2Message, 'response');
        const v5Messages = list.get.all.aiV5.ui();

        // Find the tool part
        const toolPart = v5Messages[0].parts.find(
          p => p.type && typeof p.type === 'string' && p.type.startsWith('tool-'),
        );

        expect(toolPart).toMatchObject({
          type: 'tool-test-tool',
          toolCallId: 'call-1',
          input: { param: 'value' },
          state: 'input-available', // Correct v5 state
        });
      });

      it('should convert tool invocations with result state', () => {
        const list = new MessageList({ threadId, resourceId });
        const v2Message: MastraMessageV2 = {
          id: 'msg-1',
          role: 'assistant',
          createdAt: new Date(),
          threadId,
          resourceId,
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  toolCallId: 'call-1',
                  toolName: 'test-tool',
                  step: 1,
                  state: 'result',
                  args: { param: 'value' },
                  result: { data: 'success' },
                },
              },
            ],
          },
        };

        list.add(v2Message, 'response');
        const v5Messages = list.get.all.aiV5.ui();

        // Find the tool part
        const toolPart = v5Messages[0].parts.find(
          p => p.type && typeof p.type === 'string' && p.type.startsWith('tool-'),
        );

        expect(toolPart).toMatchObject({
          type: 'tool-test-tool',
          toolCallId: 'call-1',
          input: { param: 'value' },
          output: { data: 'success' },
          state: 'output-available',
        });
      });

      it('should convert reasoning parts', () => {
        const list = new MessageList({ threadId, resourceId });
        const v2Message: MastraMessageV2 = {
          id: 'msg-1',
          role: 'assistant',
          createdAt: new Date(),
          threadId,
          resourceId,
          content: {
            format: 2,
            parts: [
              {
                type: 'reasoning',
                reasoning: '',
                details: [
                  {
                    type: 'text',
                    text: 'Thinking about the problem...',
                  },
                ],
              },
            ],
          },
        };

        list.add(v2Message, 'response');
        const v5Messages = list.get.all.aiV5.ui();

        expect(v5Messages[0].parts[0]).toMatchObject({
          type: 'reasoning',
          text: 'Thinking about the problem...',
          state: 'done',
        });
      });

      it('should convert file parts with URL handling', () => {
        const list = new MessageList({ threadId, resourceId });
        const v2Message: MastraMessageV2 = {
          id: 'msg-1',
          role: 'user',
          createdAt: new Date(),
          threadId,
          resourceId,
          content: {
            format: 2,
            parts: [
              {
                type: 'file',
                data: 'https://example.com/image.png',
                mimeType: 'image/png',
              },
            ],
          },
        };

        list.add(v2Message, 'input');
        const v5Messages = list.get.all.aiV5.ui();

        expect(v5Messages[0].parts[0]).toMatchObject({
          type: 'file',
          url: 'https://example.com/image.png',
          mediaType: 'image/png',
        });
      });
    });

    describe('V4 Core to V5 Model conversion', () => {
      it('should convert system messages correctly', () => {
        const list = new MessageList({ threadId, resourceId });
        list.addSystem('You are a helpful assistant');

        const v5Prompt = list.get.all.aiV5.prompt();
        expect(v5Prompt[0]).toMatchObject({
          role: 'system',
          content: 'You are a helpful assistant',
        });
      });

      it.skip('should convert tool calls from v4 to v5 format', () => {
        const list = new MessageList({ threadId, resourceId });
        const v4CoreMessage: AIV4CoreMessage = {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'test-tool',
              args: { param: 'value' }, // v4 uses args
            },
          ],
        };

        list.add(v4CoreMessage, 'response');
        const v5Model = list.get.all.aiV5.model();

        // TODO: This test is currently failing because tool-call parts
        // are converted to UI-style tool parts with 'input-available' state
        // which can't be converted to model messages by convertToModelMessages.
        // Need to handle tool-call parts differently in the conversion.
        expect(v5Model).toHaveLength(1);
        expect(v5Model[0].content).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'test-tool',
              input: { param: 'value' }, // v5 uses input
            }),
          ]),
        );
      });
    });
  });

  describe('AI SDK V5 API', () => {
    describe('list.get.all.aiV5.*', () => {
      it('model() should return AIV5 ModelMessages', () => {
        const list = new MessageList({ threadId, resourceId });
        list.add('User message', 'input');
        list.add({ role: 'assistant', content: 'Assistant response' }, 'response');

        const modelMessages = list.get.all.aiV5.model();

        expect(modelMessages).toHaveLength(2);
        expect(modelMessages[0].role).toBe('user');
        expect(modelMessages[1].role).toBe('assistant');

        // Verify the type structure matches AIV5 ModelMessage
        modelMessages.forEach(msg => {
          expect(msg).toHaveProperty('role');
          expect(msg).toHaveProperty('content');
        });
      });

      it('ui() should return AIV5 UIMessages', () => {
        const list = new MessageList({ threadId, resourceId });
        list.add('User message', 'input');

        const uiMessages = list.get.all.aiV5.ui();

        expect(uiMessages).toHaveLength(1);
        expect(uiMessages[0].role).toBe('user');

        // Find text part (there may be other parts like step-start)
        const textPart = uiMessages[0].parts.find(p => p.type === 'text');
        expect(textPart).toEqual({ type: 'text', text: 'User message' });
      });

      it('prompt() should include system messages', () => {
        const list = new MessageList({ threadId, resourceId });
        list.addSystem('System prompt');
        list.add('User message', 'input');

        const prompt = list.get.all.aiV5.prompt();

        expect(prompt).toHaveLength(2);
        expect(prompt[0]).toMatchObject({
          role: 'system',
          content: 'System prompt',
        });
        expect(prompt[1]).toMatchObject({
          role: 'user',
          content: expect.any(Array),
        });
      });

      it('prompt() should handle empty message list by adding default user message', () => {
        const list = new MessageList({ threadId, resourceId });

        const prompt = list.get.all.aiV5.prompt();

        expect(prompt).toHaveLength(1);
        expect(prompt[0]).toMatchObject({
          role: 'user',
          content: '.', // Default message uses a period
        });
      });

      it('prompt() should prepend user message when first message is assistant', () => {
        const list = new MessageList({ threadId, resourceId });
        list.add({ role: 'assistant', content: 'I am ready to help' }, 'response');

        const prompt = list.get.all.aiV5.prompt();

        expect(prompt).toHaveLength(2);
        expect(prompt[1]).toMatchObject({
          role: 'assistant',
          content: [{ type: 'text', text: 'I am ready to help' }],
        });
        expect(prompt[1].role).toBe('assistant');
      });

      it('llmPrompt() should return proper LanguageModelV2Prompt format', async () => {
        const list = new MessageList({ threadId, resourceId });
        list.addSystem('System message');
        list.add('User input', 'input');
        list.add({ role: 'assistant', content: 'Response' }, 'response');

        const llmPrompt = await list.get.all.aiV5.llmPrompt();

        // llmPrompt returns messages array directly based on the implementation
        expect(Array.isArray(llmPrompt)).toBe(true);
        expect(llmPrompt).toHaveLength(3);
        expect(llmPrompt[0].role).toBe('system');
        expect(llmPrompt[1].role).toBe('user');
        expect(llmPrompt[2].role).toBe('assistant');
      });
    });
  });

  describe('AI SDK V4 API', () => {
    describe('list.get.all.aiV4.*', () => {
      it('core() should return AIV4 CoreMessages', () => {
        const list = new MessageList({ threadId, resourceId });
        list.add('User message', 'input');
        list.add({ role: 'assistant', content: 'Assistant response' }, 'response');

        const coreMessages = list.get.all.aiV4.core();

        expect(coreMessages).toHaveLength(2);
        expect(coreMessages[0].role).toBe('user');
        expect(coreMessages[1].role).toBe('assistant');
      });

      it('ui() should return AIV4 UIMessages', () => {
        const list = new MessageList({ threadId, resourceId });
        list.add('User message', 'input');

        const uiMessages = list.get.all.aiV4.ui();

        expect(uiMessages).toHaveLength(1);
        expect(uiMessages[0].role).toBe('user');
        expect(uiMessages[0].content).toBe('User message');
      });

      it('prompt() should include system messages', () => {
        const list = new MessageList({ threadId, resourceId });
        list.addSystem('System prompt');
        list.add('User message', 'input');

        const prompt = list.get.all.aiV4.prompt();

        expect(prompt).toHaveLength(2);
        expect(prompt[0]).toMatchObject({
          role: 'system',
          content: 'System prompt',
        });
        expect(prompt[1]).toMatchObject({
          role: 'user',
          content: expect.any(Array),
        });
      });

      it('llmPrompt() should return proper LanguageModelV1Prompt format', () => {
        const list = new MessageList({ threadId, resourceId });
        list.addSystem('System message');
        list.add('User input', 'input');

        const llmPrompt = list.get.all.aiV4.llmPrompt();

        // llmPrompt returns messages array directly
        expect(Array.isArray(llmPrompt)).toBe(true);
        expect(llmPrompt).toHaveLength(2);
      });
    });

    describe('Deprecated method compatibility', () => {
      it('list.get.all.prompt() should delegate to aiV4.prompt()', () => {
        const list = new MessageList({ threadId, resourceId });
        list.addSystem('System');
        list.add('User', 'input');

        const deprecatedPrompt = list.get.all.prompt();
        const v4Prompt = list.get.all.aiV4.prompt();

        expect(deprecatedPrompt).toEqual(v4Prompt);
      });

      it('list.get.all.ui() should delegate to aiV4.ui()', () => {
        const list = new MessageList({ threadId, resourceId });
        list.add('Message', 'input');

        const deprecatedUI = list.get.all.ui();
        const v4UI = list.get.all.aiV4.ui();

        expect(deprecatedUI).toEqual(v4UI);
      });

      it('list.get.all.core() should delegate to aiV4.core()', () => {
        const list = new MessageList({ threadId, resourceId });
        list.add('Message', 'input');

        const deprecatedCore = list.get.all.core();
        const v4Core = list.get.all.aiV4.core();

        expect(deprecatedCore).toEqual(v4Core);
      });
    });
  });

  describe('Cross-Version Compatibility', () => {
    it('should handle v4 UIMessage → v5 ModelMessage conversion', () => {
      const list = new MessageList({ threadId, resourceId });

      const v4UIMessage: AIV4UIMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello from v4',
        parts: [{ type: 'text', text: 'Hello from v4' }],
        createdAt: new Date(),
      };

      list.add(v4UIMessage, 'input');

      const v5Model = list.get.all.aiV5.model();
      expect(v5Model).toHaveLength(1);
      expect(v5Model[0]).toMatchObject({
        role: 'user',
        content: [{ type: 'text', text: 'Hello from v4' }],
      });
    });

    it('should handle v5 UIMessage → v4 CoreMessage conversion', () => {
      const list = new MessageList({ threadId, resourceId });

      const v5UIMessage: AIV5UIMessage = {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello from v5' }],
      };

      list.add(v5UIMessage, 'input');

      const v4Core = list.get.all.aiV4.core();
      expect(v4Core).toHaveLength(1);
      expect(v4Core[0]).toMatchObject({
        role: 'user',
        content: [{ type: 'text', text: 'Hello from v5' }],
      });
    });

    it('should handle string message in both v4 and v5 formats', () => {
      const list = new MessageList({ threadId, resourceId });
      list.add('Simple string message', 'input');

      const v4Core = list.get.all.aiV4.core();
      const v5Model = list.get.all.aiV5.model();

      expect(v4Core[0].content).toEqual([{ type: 'text', text: 'Simple string message' }]);
      expect(v5Model[0].content).toEqual([{ type: 'text', text: 'Simple string message' }]);
    });

    it.skip('should handle v4 CoreMessage with tools → v5 with correct tool format', () => {
      const list = new MessageList({ threadId, resourceId });

      const v4CoreWithTool: AIV4CoreMessage = {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'calculator',
            args: { expression: '2+2' },
          },
        ],
      };

      list.add(v4CoreWithTool, 'response');

      const v5Model = list.get.all.aiV5.model();
      expect(v5Model[0].content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'calculator',
            input: { expression: '2+2' }, // args → input
          }),
        ]),
      );
    });

    it('should handle v5 ModelMessage with reasoning → v4 with correct format', () => {
      const list = new MessageList({ threadId, resourceId });

      // Add a v5 message with reasoning through the conversion pipeline
      const v2Message: MastraMessageV2 = {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date(),
        threadId,
        resourceId,
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [
                {
                  type: 'text',
                  text: 'Let me think about this...',
                },
              ],
            },
            {
              type: 'text',
              text: 'The answer is 42',
            },
          ],
        },
      };

      list.add(v2Message, 'response');

      const v4Core = list.get.all.aiV4.core();
      expect(v4Core[0].content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'reasoning',
            text: 'Let me think about this...',
          }),
          expect.objectContaining({
            type: 'text',
            text: 'The answer is 42',
          }),
        ]),
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message list with prompt methods', () => {
      const list = new MessageList({ threadId, resourceId });

      const v4Prompt = list.get.all.aiV4.prompt();
      const v5Prompt = list.get.all.aiV5.prompt();

      // Both should add a default user message
      expect(v4Prompt).toHaveLength(1);
      expect(v4Prompt[0].role).toBe('user');

      expect(v5Prompt).toHaveLength(1);
      expect(v5Prompt[0].role).toBe('user');
    });

    it('should throw error for system messages with wrong role', () => {
      const list = new MessageList({ threadId, resourceId });

      expect(() => {
        list.add({ role: 'user', content: 'Not a system message' } as any, 'system');
      }).toThrow();
    });

    it('should handle messages with only assistant role', () => {
      const list = new MessageList({ threadId, resourceId });
      list.add({ role: 'assistant', content: 'Assistant only' }, 'response');

      const v4Prompt = list.get.all.aiV4.prompt();
      const v5Prompt = list.get.all.aiV5.prompt();

      // Should prepend user message
      expect(v4Prompt).toHaveLength(2);
      expect(v4Prompt[0].role).toBe('user');
      expect(v4Prompt[1].role).toBe('assistant');

      expect(v5Prompt).toHaveLength(2);
      expect(v5Prompt[0].role).toBe('user');
      expect(v5Prompt[1].role).toBe('assistant');
    });

    it('should handle tool invocations with missing fields gracefully', () => {
      const list = new MessageList({ threadId, resourceId });

      const incompleteToolMessage: MastraMessageV2 = {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date(),
        threadId,
        resourceId,
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-1',
                toolName: 'test-tool',
                step: 1,
                state: 'call',
                args: {}, // Empty args
              },
            },
          ],
        },
      };

      list.add(incompleteToolMessage, 'response');

      const v5UI = list.get.all.aiV5.ui();
      // Find the tool part (may not be first)
      const toolPart = v5UI[0].parts.find(p => p.type && typeof p.type === 'string' && p.type.startsWith('tool-'));

      expect(toolPart).toMatchObject({
        type: 'tool-test-tool',
        toolCallId: 'call-1',
        input: {},
        state: 'input-available', // Correct v5 state
      });
    });

    it('should filter out empty reasoning parts', () => {
      const list = new MessageList({ threadId, resourceId });

      const messageWithEmptyReasoning: MastraMessageV2 = {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date(),
        threadId,
        resourceId,
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [], // Empty reasoning
            },
            {
              type: 'text',
              text: 'Actual content',
            },
          ],
        },
      };

      list.add(messageWithEmptyReasoning, 'response');

      const v4Core = list.get.all.aiV4.core();
      // Empty reasoning should be filtered out in conversion
      expect(v4Core[0].content).toHaveLength(1);
      expect(v4Core[0].content[0]).toMatchObject({
        type: 'text',
        text: 'Actual content',
      });
    });

    it('should preserve message order in conversions', () => {
      const list = new MessageList({ threadId, resourceId });

      list.add('First user message', 'input');
      list.add({ role: 'assistant', content: 'First response' }, 'response');
      list.add('Second user message', 'input');
      list.add({ role: 'assistant', content: 'Second response' }, 'response');

      const v4Core = list.get.all.aiV4.core();
      const v5Model = list.get.all.aiV5.model();

      expect(v4Core).toHaveLength(4);
      expect(v5Model).toHaveLength(4);

      // Check order is preserved
      expect(v4Core[0].role).toBe('user');
      expect(v4Core[1].role).toBe('assistant');
      expect(v4Core[2].role).toBe('user');
      expect(v4Core[3].role).toBe('assistant');

      expect(v5Model[0].role).toBe('user');
      expect(v5Model[1].role).toBe('assistant');
      expect(v5Model[2].role).toBe('user');
      expect(v5Model[3].role).toBe('assistant');
    });

    describe('Provider metadata preservation', () => {
      it('should preserve providerMetadata on file parts during V5 UI -> V2 -> V5 UI roundtrip', () => {
        const list = new MessageList({ threadId, resourceId });

        const providerMetadata = {
          custom: {
            value: 'metadata',
          },
          someValue: {
            value: 123,
          },
        };
        const v5UIMessage: AIV5UIMessage = {
          id: 'msg-1',
          role: 'user',
          parts: [
            {
              type: 'file',
              url: 'https://example.com/image.png',
              mediaType: 'image/png',
              providerMetadata,
            },
          ],
        };

        list.add(v5UIMessage, 'input');

        // Get V2 messages and check providerMetadata was preserved
        const v2Messages = list.get.all.v2();
        expect(v2Messages).toHaveLength(1);
        const filePart = v2Messages[0].content.parts.find(p => p.type === 'file');
        expect(filePart).toBeDefined();
        expect(filePart?.providerMetadata).toEqual(providerMetadata);

        // Convert back to V5 UI and check providerMetadata is still there
        const v5UIBack = list.get.all.aiV5.ui();
        expect(v5UIBack).toHaveLength(1);
        const v5FilePart = v5UIBack[0].parts.find(p => p.type === 'file');
        expect(v5FilePart).toBeDefined();
        expect(v5FilePart?.providerMetadata).toEqual(providerMetadata);
      });

      it('should preserve providerMetadata on text parts during V5 UI -> V2 -> V5 UI roundtrip', () => {
        const list = new MessageList({ threadId, resourceId });
        const providerMetadata = {
          modelUsed: { value: 'gpt-4' },
          temperature: { value: 0.7 },
        };

        const v5UIMessage: AIV5UIMessage = {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Hello world',
              providerMetadata,
            },
          ],
        };

        list.add(v5UIMessage, 'response');

        // Get V2 messages and check providerMetadata was preserved
        const v2Messages = list.get.all.v2();
        expect(v2Messages).toHaveLength(1);
        const textPart = v2Messages[0].content.parts.find(p => p.type === 'text');
        expect(textPart).toBeDefined();
        expect(textPart?.providerMetadata).toEqual(providerMetadata);

        // Convert back to V5 UI and check providerMetadata is still there
        const v5UIBack = list.get.all.aiV5.ui();
        expect(v5UIBack).toHaveLength(1);
        const v5TextPart = v5UIBack[0].parts.find(p => p.type === 'text');
        expect(v5TextPart).toBeDefined();
        expect(v5TextPart?.providerMetadata).toEqual(providerMetadata);
      });

      it('should preserve providerMetadata on reasoning parts during V5 UI -> V2 -> V5 UI roundtrip', () => {
        const list = new MessageList({ threadId, resourceId });

        const providerMetadata = {
          thinkingModel: { value: 'o1-preview' },
          thinkingTime: { value: 2500 },
        };

        const v5UIMessage: AIV5UIMessage = {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'reasoning',
              text: 'Let me think about this...',
              providerMetadata,
            },
          ],
        };

        list.add(v5UIMessage, 'response');

        // Get V2 messages and check providerMetadata was preserved
        const v2Messages = list.get.all.v2();
        expect(v2Messages).toHaveLength(1);
        const reasoningPart = v2Messages[0].content.parts.find(p => p.type === 'reasoning');
        expect(reasoningPart).toBeDefined();
        expect(reasoningPart?.providerMetadata).toEqual(providerMetadata);

        // Convert back to V5 UI and check providerMetadata is still there
        const v5UIBack = list.get.all.aiV5.ui();
        expect(v5UIBack).toHaveLength(1);
        const v5ReasoningPart = v5UIBack[0].parts.find(p => p.type === 'reasoning');
        expect(v5ReasoningPart).toBeDefined();
        expect(v5ReasoningPart?.providerMetadata).toEqual(providerMetadata);
      });

      it('should preserve callProviderMetadata on tool invocations during V5 UI -> V2 -> V5 UI roundtrip', () => {
        const list = new MessageList({ threadId, resourceId });

        const callProviderMetadata = {
          toolVersion: { value: '1.0' },
          executionTime: { value: 100 },
        };

        const v5UIMessage: AIV5UIMessage = {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-test_tool',
              toolCallId: 'call-1',
              state: 'output-available',
              input: { param: 'value' },
              output: { result: 'success' },
              callProviderMetadata,
            },
          ],
        };

        list.add(v5UIMessage, 'response');

        // Get V2 messages and check callProviderMetadata was preserved on tool-invocation
        const v2Messages = list.get.all.v2();
        expect(v2Messages).toHaveLength(1);
        const toolPart = v2Messages[0].content.parts.find(p => p.type === 'tool-invocation');
        expect(toolPart).toBeDefined();
        expect(toolPart?.providerMetadata).toEqual(callProviderMetadata);

        // Convert back to V5 UI and check callProviderMetadata is still there
        const v5UIBack = list.get.all.aiV5.ui();
        expect(v5UIBack).toHaveLength(1);
        const v5ToolPart = v5UIBack[0].parts.find(p => p.type === 'tool-test_tool');
        expect(v5ToolPart).toBeDefined();
        if (!isToolUIPart(v5ToolPart!) || !(`callProviderMetadata` in v5ToolPart)) {
          throw new Error(`should be a tool part with callProviderMetadata`);
        }
        expect(v5ToolPart?.callProviderMetadata).toEqual(callProviderMetadata);
      });

      it('should preserve providerMetadata on source-url parts during V5 UI -> V2 -> V5 UI roundtrip', () => {
        const list = new MessageList({ threadId, resourceId });

        const fetchTime = Date.now();
        const providerMetadata = {
          fetchTime: { value: fetchTime },
          contentType: { value: 'text/html' },
        };

        const v5UIMessage: AIV5UIMessage = {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'source-url',
              url: 'https://example.com/doc',
              sourceId: 'doc-1',
              providerMetadata,
            },
          ],
        };

        list.add(v5UIMessage, 'response');

        // Get V2 messages and check providerMetadata was preserved
        const v2Messages = list.get.all.v2();
        expect(v2Messages).toHaveLength(1);
        const sourcePart = v2Messages[0].content.parts.find(p => p.type === 'source');
        expect(sourcePart).toBeDefined();
        expect(sourcePart?.providerMetadata).toEqual(providerMetadata);

        // Convert back to V5 UI and check providerMetadata is still there
        const v5UIBack = list.get.all.aiV5.ui();
        expect(v5UIBack).toHaveLength(1);
        const v5SourcePart = v5UIBack[0].parts.find(p => p.type === 'source-url');
        expect(v5SourcePart).toBeDefined();
        expect(v5SourcePart?.providerMetadata).toEqual(providerMetadata);
      });

      it('should preserve providerMetadata when mixing multiple part types', () => {
        const list = new MessageList({ threadId, resourceId });

        const textProviderMetadata = { textMeta: { value: true } };
        const fileProviderMetadata = { fileMeta: { value: true } };
        const reasoningProviderMetadata = { reasoningMeta: { value: true } };

        const v5UIMessage: AIV5UIMessage = {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Here is the result:',
              providerMetadata: textProviderMetadata,
            },
            {
              type: 'file',
              url: 'data:image/png;base64,abc123',
              mediaType: 'image/png',
              providerMetadata: fileProviderMetadata,
            },
            {
              type: 'reasoning',
              text: 'Thinking...',
              providerMetadata: reasoningProviderMetadata,
            },
          ],
        };

        list.add(v5UIMessage, 'response');

        // Get V2 messages and verify all providerMetadata preserved
        const v2Messages = list.get.all.v2();
        const parts = v2Messages[0].content.parts;

        const textPart = parts.find(p => p.type === 'text');
        expect(textPart?.providerMetadata).toEqual(textProviderMetadata);

        const filePart = parts.find(p => p.type === 'file');
        expect(filePart?.providerMetadata).toEqual(fileProviderMetadata);

        const reasoningPart = parts.find(p => p.type === 'reasoning');
        expect(reasoningPart?.providerMetadata).toEqual(reasoningProviderMetadata);

        // Convert back to V5 UI and verify all metadata still there
        const v5UIBack = list.get.all.aiV5.ui();
        const v5Parts = v5UIBack[0].parts;

        const v5TextPart = v5Parts.find(p => p.type === 'text');
        expect(v5TextPart?.providerMetadata).toEqual(textProviderMetadata);

        const v5FilePart = v5Parts.find(p => p.type === 'file');
        expect(v5FilePart?.providerMetadata).toEqual(fileProviderMetadata);

        const v5ReasoningPart = v5Parts.find(p => p.type === 'reasoning');
        expect(v5ReasoningPart?.providerMetadata).toEqual(reasoningProviderMetadata);
      });
    });
  });
});
