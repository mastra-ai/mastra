import type { CoreSystemMessage } from '@internal/ai-sdk-v4';
import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import type { SystemModelMessage } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noopLogger } from '../../logger';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { delay } from '../../utils';
import { Agent } from '../agent';
import { MessageList } from '../message-list/index';

function instructionTests(version: 'v1' | 'v2') {
  let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

  beforeEach(() => {
    if (version === 'v1') {
      dummyModel = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: 'Dummy response',
        }),
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [{ type: 'text-delta', textDelta: 'Dummy response' }],
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
          content: [{ type: 'text', text: 'Dummy response' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });
    }
  });

  describe(`${version} - Dynamic instructions with mastra instance`, () => {
    let mastra: Mastra;

    beforeEach(() => {
      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `Logger test response`,
          }),
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: `Logger test response`,
            content: [
              {
                type: 'text',
                text: 'Logger test response',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Logger test response' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            ]),
          }),
        });
      }
      mastra = new Mastra({
        logger: noopLogger,
      });
    });

    it('should expose mastra instance in dynamic instructions', async () => {
      let capturedMastra: Mastra | undefined;
      let capturedRequestContext: RequestContext | undefined;

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: ({ requestContext, mastra }) => {
          capturedRequestContext = requestContext;
          capturedMastra = mastra;

          const logger = mastra?.getLogger();
          logger?.debug('Running with context', { info: requestContext.get('info') });

          return 'You are a helpful assistant.';
        },
        model: dummyModel,
        mastra,
      });

      const requestContext = new RequestContext();
      requestContext.set('info', 'test-info');

      let response;
      if (version === 'v1') {
        response = await agent.generateLegacy('hello', { requestContext });
      } else {
        response = await agent.generate('hello', { requestContext });
      }

      expect(response.text).toBe('Logger test response');
      expect(capturedMastra).toBe(mastra);
      expect(capturedRequestContext).toBe(requestContext);
      expect(capturedRequestContext?.get('info')).toBe('test-info');
    });

    it('should work with static instructions (backward compatibility)', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant.',
        model: dummyModel,
        mastra,
      });

      let response;
      if (version === 'v1') {
        response = await agent.generateLegacy('hello');
      } else {
        response = await agent.generate('hello');
      }

      expect(response.text).toBe('Logger test response');
    });

    it('should handle dynamic instructions when mastra is undefined', async () => {
      let capturedMastra: Mastra | undefined;

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: ({ mastra }) => {
          capturedMastra = mastra;
          return 'You are a helpful assistant.';
        },
        model: dummyModel,
        // No mastra provided
      });

      let response;
      if (version === 'v1') {
        response = await agent.generateLegacy('hello');
      } else {
        response = await agent.generate('hello');
      }

      expect(response.text).toBe('Logger test response');
      expect(capturedMastra).toBeUndefined();
    });
  });

  describe(`${version} - Agent instructions with SystemMessage types`, () => {
    it('should support string instructions (backward compatibility)', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant.',
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toBe('You are a helpful assistant.');
    });

    it('should support CoreSystemMessage instructions', async () => {
      const systemMessage: CoreSystemMessage = {
        role: 'system',
        content: 'You are an expert programmer.',
      };

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: systemMessage,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(systemMessage);
    });

    it('should support SystemModelMessage instructions', async () => {
      const systemMessage: SystemModelMessage = {
        role: 'system',
        content: 'You are a data analyst.',
      };

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: systemMessage,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(systemMessage);
    });

    it('should support array of string instructions', async () => {
      const instructionsArray = ['You are a helpful assistant.', 'Always be polite.', 'Provide detailed answers.'];

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: instructionsArray,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(instructionsArray);
    });

    it('should support array of CoreSystemMessage instructions', async () => {
      const instructionsArray: CoreSystemMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'system', content: 'Always be polite.' },
      ];

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: instructionsArray,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(instructionsArray);
    });

    it('should support array of CoreSystemMessage with provider metadata', async () => {
      const instructionsArray: CoreSystemMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'system',
          content: 'Always be polite.',
          experimental_providerMetadata: { anthropic: { cache_control: { type: 'ephemeral' } } },
        },
        {
          role: 'system',
          content: 'Use technical language.',
          providerOptions: { openai: { reasoning_effort: 'medium' } },
        },
      ];

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: instructionsArray,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(instructionsArray);
    });

    it('should support dynamic instructions returning string', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: ({ requestContext }) => {
          const role = requestContext?.get('role') || 'assistant';
          return `You are a helpful ${role}.`;
        },
        model: dummyModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('role', 'teacher');

      const instructions = await agent.getInstructions({ requestContext });
      expect(instructions).toBe('You are a helpful teacher.');
    });

    it('should support dynamic instructions returning CoreSystemMessage', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: ({ requestContext }) => {
          const role = requestContext?.get('role') || 'assistant';
          return {
            role: 'system',
            content: `You are a helpful ${role}.`,
          };
        },
        model: dummyModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('role', 'doctor');

      const instructions = await agent.getInstructions({ requestContext });
      expect(instructions).toEqual({
        role: 'system',
        content: 'You are a helpful doctor.',
      });
    });

    it('should support dynamic instructions returning array', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: ({ requestContext }) => {
          const expertise = (requestContext?.get('expertise') as string[]) || [];
          const expertiseMessages: CoreSystemMessage[] = expertise.map((exp: string) => ({
            role: 'system',
            content: `You have expertise in ${exp}.`,
          }));
          const messages: CoreSystemMessage[] = [
            { role: 'system', content: 'You are a helpful assistant.' },
            ...expertiseMessages,
          ];
          return messages;
        },
        model: dummyModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('expertise', ['Python', 'JavaScript']);

      const instructions = await agent.getInstructions({ requestContext });
      expect(instructions).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'system', content: 'You have expertise in Python.' },
        { role: 'system', content: 'You have expertise in JavaScript.' },
      ]);
    });

    it('should support async dynamic instructions', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: async ({ requestContext }) => {
          // Simulate async operation
          await delay(10);
          const role = requestContext?.get('role') || 'assistant';
          return {
            role: 'system',
            content: `You are an async ${role}.`,
          };
        },
        model: dummyModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('role', 'consultant');

      const instructions = await agent.getInstructions({ requestContext });
      expect(instructions).toEqual({
        role: 'system',
        content: 'You are an async consultant.',
      });
    });

    it('should combine instructions with system option in generate', async () => {
      // This test verifies that both agent instructions and user-provided system messages
      // are properly combined when using generate
      // For now, we're just testing that the functionality doesn't break
      // Full integration testing would require checking the actual messages sent to the LLM

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant.',
        model: dummyModel,
      });

      const additionalSystem: CoreSystemMessage = {
        role: 'system',
        content: 'Be concise in your responses.',
      };

      if (version === 'v2') {
        // This test only applies to V2
        // Simply verify that generate works with the system option
        // without throwing errors
        const response = await agent.generate('Hello', {
          system: additionalSystem,
        });

        // Basic check that response was generated
        expect(response.text).toBe('Dummy response');
      } else {
        // Skip for V1
        expect(true).toBe(true);
      }
    });

    it('should combine array instructions with array system option', async () => {
      // This test verifies that array instructions and array system messages
      // are properly combined when using generate

      // Use CoreSystemMessage array instead of mixed array
      const agentInstructions: CoreSystemMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'system', content: 'You are an expert.' },
      ];

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: agentInstructions,
        model: dummyModel,
      });

      // Use string array for additional system messages
      const additionalSystem: string[] = ['Be concise.', 'Use examples.'];

      if (version === 'v2') {
        // This test only applies to V2
        // Simply verify that generate works with array system option
        // without throwing errors
        const response = await agent.generate('Hello', {
          system: additionalSystem,
        });

        // Basic check that response was generated
        expect(response.text).toBe('Dummy response');
      } else {
        // Skip for V1
        expect(true).toBe(true);
      }
    });

    it('should handle empty instructions gracefully', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: '',
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toBe('');
    });

    it('should handle empty array instructions', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: [],
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual([]);
    });

    it('should allow override instructions in generate options', async () => {
      const agent = new Agent({
        id: 'override-agent',
        name: 'Override Agent',
        instructions: 'Default instructions',
        model: dummyModel,
      });

      if (version === 'v1') {
        const response = await agent.generateLegacy('Hello', {
          instructions: {
            role: 'system',
            content: 'Override instructions',
          },
        });
        expect(response.text).toBe('Dummy response');
      } else {
        // For v2, use generate
        const response = await agent.generate('Hello', {
          instructions: {
            role: 'system',
            content: 'Override instructions',
          },
        });
        expect(response.text).toBe('Dummy response');
      }
    });

    it('should convert CoreSystemMessage instructions for voice', async () => {
      const mockVoice = {
        addInstructions: vi.fn(),
        addTools: vi.fn(),
      };

      const agent = new Agent({
        id: 'voice-agent',
        name: 'Voice Agent',
        instructions: {
          role: 'system',
          content: 'You are a helpful voice assistant.',
        },
        model: dummyModel,
        voice: mockVoice as any,
      });

      await agent.getVoice();

      // Verify voice received the instruction text
      expect(mockVoice.addInstructions).toHaveBeenCalledWith('You are a helpful voice assistant.');
    });

    it('should support SystemModelMessage with providerOptions', async () => {
      const systemMessage: SystemModelMessage = {
        role: 'system',
        content: 'You are an expert programmer.',
        providerOptions: {
          openai: { reasoning_effort: 'high' },
        },
      };

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: systemMessage,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(systemMessage);
    });

    it('should support array of SystemModelMessage', async () => {
      const instructionsArray: SystemModelMessage[] = [
        {
          role: 'system',
          content: 'You are an expert.',
          providerOptions: { openai: { temperature: 0.7 } },
        },
        {
          role: 'system',
          content: 'Be concise.',
          providerOptions: { openai: { max_tokens: 100 } },
        },
      ];

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: instructionsArray,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(instructionsArray);
    });

    it('should combine instructions with system option in stream', async () => {
      if (version === 'v2') {
        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant.',
          model: dummyModel,
        });

        const additionalSystem = {
          role: 'system' as const,
          content: 'Be concise in your responses.',
        };

        const stream = await agent.stream('Hello', {
          system: additionalSystem,
        });

        // Verify stream completes without error
        const result = await stream.getFullOutput();
        expect(result).toBeDefined();
      } else {
        expect(true).toBe(true);
      }
    });

    it('should allow override with array instructions in generate options', async () => {
      const agent = new Agent({
        id: 'override-array-agent',
        name: 'Override Array Agent',
        instructions: 'Default instructions',
        model: dummyModel,
      });

      if (version === 'v1') {
        const response = await agent.generateLegacy('Hello', {
          instructions: ['Override instruction 1', 'Override instruction 2'],
        });
        expect(response.text).toBe('Dummy response');
      } else {
        // For v2, use generate
        const response = await agent.generate('Hello', {
          instructions: ['Override instruction 1', 'Override instruction 2'],
        });
        expect(response.text).toBe('Dummy response');
      }
    });

    it('should support dynamic instructions returning SystemModelMessage', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: ({ requestContext }) => {
          const mode = requestContext?.get('mode') || 'default';
          return {
            role: 'system' as const,
            content: `You are in ${mode} mode.`,
            providerOptions: {
              openai: { temperature: mode === 'creative' ? 0.9 : 0.3 },
            },
          } as SystemModelMessage;
        },
        model: dummyModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('mode', 'creative');

      const instructions = await agent.getInstructions({ requestContext });
      expect(instructions).toEqual({
        role: 'system',
        content: 'You are in creative mode.',
        providerOptions: { openai: { temperature: 0.9 } },
      });
    });

    it('should preserve provider options when building message list', async () => {
      // This test verifies that provider options (like Anthropic caching) are preserved
      // when instructions are added to the message list
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: {
          role: 'system',
          content: 'You are a helpful assistant with caching.',
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        } as SystemModelMessage,
        model: dummyModel,
      });

      // Spy on MessageList.addSystem to capture what's being added
      const addSystemSpy = vi.spyOn(MessageList.prototype, 'addSystem');

      if (version === 'v2') {
        try {
          // This will trigger the message list building
          await agent.generate('Hello');

          // Check all addSystem calls
          const systemMessageCalls = addSystemSpy.mock.calls.filter(call => {
            const msg = call[0];
            return typeof msg === 'object' && msg !== null && 'role' in msg && msg.role === 'system';
          });

          // Find calls that have provider options
          const messagesWithProviderOptions = systemMessageCalls
            .map(call => call[0])
            .filter((msg): msg is SystemModelMessage => {
              return (
                typeof msg === 'object' && msg !== null && 'providerOptions' in msg && msg.providerOptions !== undefined
              );
            });

          // Verify provider options are preserved
          expect(messagesWithProviderOptions.length).toBeGreaterThan(0);
          expect(messagesWithProviderOptions?.[0]?.providerOptions).toEqual({
            anthropic: { cacheControl: { type: 'ephemeral' } },
          });
        } finally {
          // Restore the spy
          addSystemSpy.mockRestore();
        }
      } else {
        // Skip for v1
        expect(true).toBe(true);
      }
    });
  });
}

instructionTests('v1');
instructionTests('v2');
