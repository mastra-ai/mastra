import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';

function titleGenerationTests(version: 'v1' | 'v2') {
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

  describe(`${version} - title generation with file parts`, () => {
    it('should not throw TypeError when message contains file parts', async () => {
      const agent = new Agent({
        id: 'file-title-test-agent',
        name: 'File Title Test Agent',
        instructions: 'test agent',
        model: dummyModel,
      });

      // File part input with text - this previously caused a TypeError
      // because generateTitleFromUserMessage accessed part.data on UI-format parts
      // which use part.url instead
      const result = await agent.generateTitleFromUserMessage({
        message: {
          role: 'user',
          content: [
            { type: 'file' as const, data: 'data:image/png;base64,iVBOR', mimeType: 'image/png' },
            { type: 'text' as const, text: 'Describe this image' },
          ],
        },
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate title when message contains only a file part', async () => {
      const agent = new Agent({
        id: 'file-only-title-test-agent',
        name: 'File Only Title Test Agent',
        instructions: 'test agent',
        model: dummyModel,
      });

      const result = await agent.generateTitleFromUserMessage({
        message: {
          role: 'user',
          content: [{ type: 'file' as const, data: 'data:image/png;base64,iVBOR', mimeType: 'image/png' }],
        },
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should send only plain text to the title model, not JSON-serialized part objects', async () => {
      // Regression: previously the title model received JSON.stringify(partsToGen) which sent
      // the full TextPart objects as a JSON string (e.g. [{"type":"text","text":"..."}]).
      // When message objects contained metadata with strings like "mastra", the title model
      // would see those and produce titles referencing internal framework details.
      let capturedUserContent: any[] = [];

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const userMsg = messages.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: 'Weather in Paris',
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const userMsg = messages.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: 'Weather in Paris',
              content: [{ type: 'text', text: 'Weather in Paris' }],
              warnings: [],
            };
          },
        });
      }

      const agent = new Agent({
        id: 'text-only-title-agent',
        name: 'Text Only Title Agent',
        instructions: 'test agent',
        model: titleModel,
      });

      await agent.generateTitleFromUserMessage({
        message: {
          role: 'user',
          content: 'What is the weather in Paris?',
        },
      });

      // The model receives parts from MessageList, but the text content should be
      // the plain user text — not a JSON-serialized array of TextPart objects
      const textParts = capturedUserContent.filter((p: any) => p.type === 'text');
      const allText = textParts.map((p: any) => p.text).join('\n');
      expect(allText).toContain('What is the weather in Paris?');
      // Must NOT contain JSON artifacts from the old JSON.stringify approach
      expect(allText).not.toContain('"type"');
      expect(allText).not.toContain('{"');
    });

    it('should not leak metadata or framework internals into title generation input', async () => {
      // Simulates a real-world scenario where the user message object has metadata
      // containing framework strings like "mastra". Only the text content should
      // reach the title model — not providerOptions, createdAt timestamps, etc.
      let capturedUserContent: any[] = [];

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const userMsg = messages.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: 'Image Description Request',
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const userMsg = messages.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: 'Image Description Request',
              content: [{ type: 'text', text: 'Image Description Request' }],
              warnings: [],
            };
          },
        });
      }

      const agent = new Agent({
        id: 'no-metadata-leak-agent',
        name: 'No Metadata Leak Agent',
        instructions: 'test agent',
        model: titleModel,
      });

      // Message with file parts and text — file parts get converted to descriptive text
      await agent.generateTitleFromUserMessage({
        message: {
          role: 'user',
          content: [
            { type: 'file' as const, data: 'data:image/png;base64,iVBOR', mimeType: 'image/png' },
            { type: 'text' as const, text: 'Describe this image for me' },
          ],
        },
      });

      // Extract just the text from the parts the model received
      const textParts = capturedUserContent.filter((p: any) => p.type === 'text');
      const allText = textParts.map((p: any) => p.text).join('\n');

      // Should contain the actual user text and the file description
      expect(allText).toContain('Describe this image for me');
      expect(allText).toContain('User added image/png file');
      // Should NOT contain JSON structure from old JSON.stringify approach
      expect(allText).not.toContain('"type":"text"');
      expect(allText).not.toContain('[{');
      // Should NOT contain providerOptions/metadata that MessageList adds internally
      expect(allText).not.toContain('providerOptions');
      expect(allText).not.toContain('createdAt');
    });

    it('should format multi-turn conversations with all part types for title generation', async () => {
      // When minMessages > 1, title generation fires after multiple turns.
      // The title model should receive all messages formatted with roles,
      // including assistant responses, tool calls, and tool results.
      let capturedUserContent: any[] = [];

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const userMsg = messages.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: 'Paris Weather Check',
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const userMsg = messages.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: 'Paris Weather Check',
              content: [{ type: 'text', text: 'Paris Weather Check' }],
              warnings: [],
            };
          },
        });
      }

      const agent = new Agent({
        id: 'multi-turn-title-agent',
        name: 'Multi Turn Title Agent',
        instructions: 'test agent',
        model: titleModel,
      });

      const uiMessages = [
        {
          id: '1',
          role: 'user' as const,
          content: '',
          parts: [{ type: 'text' as const, text: 'What is the weather in Paris?' }],
        },
        {
          id: '2',
          role: 'assistant' as const,
          content: '',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                toolCallId: 'call-1',
                toolName: 'getWeather',
                state: 'call' as const,
                args: { city: 'Paris' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                toolCallId: 'call-1',
                toolName: 'getWeather',
                state: 'result' as const,
                args: { city: 'Paris' },
                result: { temp: 22, condition: 'sunny' },
              },
            },
            { type: 'text' as const, text: 'The weather in Paris is 22°C and sunny.' },
          ],
        },
        {
          id: '3',
          role: 'user' as const,
          content: '',
          parts: [{ type: 'text' as const, text: 'What about tomorrow?' }],
        },
      ];

      await agent.generateTitleFromUserMessage({
        messages: uiMessages,
      });

      const textParts = capturedUserContent.filter((p: any) => p.type === 'text');
      const allText = textParts.map((p: any) => p.text).join('\n');

      // Should include user messages with role prefix
      expect(allText).toContain('User: What is the weather in Paris?');
      expect(allText).toContain('User: What about tomorrow?');
      // Should include assistant text with role prefix
      expect(allText).toContain('Assistant: The weather in Paris is 22°C and sunny.');
      // Should include tool call and result
      expect(allText).toContain('Tool Call getWeather:');
      expect(allText).toContain('Tool Result getWeather:');
      // Tool args/result payloads should be included so the title model has context
      expect(allText).toContain('Paris');
      expect(allText).toMatch(/22|sunny/);
      // Should NOT contain metadata
      expect(allText).not.toContain('providerOptions');
      expect(allText).not.toContain('toolCallId');
    });

    it('should send each conversation message to the title model exactly once (no content/parts duplication)', async () => {
      // Regression: the standard title path feeds AIV4 UI messages, which carry the
      // same text in both `content` (string) and a text `part`. formatMessagesForTitle
      // used to emit both, so the title model received every message twice, e.g.
      //   User: hi
      //   User: hi
      //   Assistant: Dummy response
      //   Assistant: Dummy response
      let capturedUserContent: any[] = [];

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const userMsg = options.prompt.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: 'Greeting',
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const userMsg = options.prompt.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: 'Greeting',
              content: [{ type: 'text', text: 'Greeting' }],
              warnings: [],
            };
          },
        });
      }

      const mockMemory = new MockMemory();
      mockMemory.getMergedThreadConfig = () => ({
        generateTitle: {
          model: titleModel,
        },
      });

      const agent = new Agent({
        id: 'dedupe-title-agent',
        name: 'Dedupe Title Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generateLegacy('hi', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-dedupe',
              title: '', // Empty title triggers title generation
            },
          },
        });
      } else {
        await agent.generate('hi', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-dedupe',
              title: '', // Empty title triggers title generation
            },
          },
        });
      }

      // Title generation is fire-and-forget after the turn completes
      await new Promise(resolve => setTimeout(resolve, 500));

      const textParts = capturedUserContent.filter((p: any) => p.type === 'text');
      const allText = textParts.map((p: any) => p.text).join('\n');

      // The legacy (v1) path sends only the most recent user message to the title
      // model; the v2 path sends the full transcript. Either way, each message must
      // appear exactly once.
      expect(allText).toBe(version === 'v1' ? 'User: hi' : 'User: hi\nAssistant: Dummy response');
      // No JSON artifacts
      expect(allText).not.toContain('{');
      expect(allText).not.toContain('"type"');
      expect(allText).not.toContain('providerOptions');
    });

    it('should still emit string content when a message has no text part (tool-invocation only)', async () => {
      // Pins the content fallback: a hand-built message with string `content` and only
      // a tool-invocation part has no text part, so the content line must still be
      // emitted (alongside the tool lines) — exactly once each.
      let capturedUserContent: any[] = [];

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const userMsg = options.prompt.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: 'Weather Check',
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const userMsg = options.prompt.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: 'Weather Check',
              content: [{ type: 'text', text: 'Weather Check' }],
              warnings: [],
            };
          },
        });
      }

      const agent = new Agent({
        id: 'content-fallback-title-agent',
        name: 'Content Fallback Title Agent',
        instructions: 'test agent',
        model: titleModel,
      });

      await agent.generateTitleFromUserMessage({
        messages: [
          {
            id: '1',
            role: 'user' as const,
            content: 'Please check the weather',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  toolCallId: 'call-1',
                  toolName: 'getWeather',
                  state: 'result' as const,
                  args: { city: 'Paris' },
                  result: { temp: 22, condition: 'sunny' },
                },
              },
            ],
          },
        ],
      });

      const textParts = capturedUserContent.filter((p: any) => p.type === 'text');
      const allText = textParts.map((p: any) => p.text).join('\n');
      const lines = allText.split('\n');

      // The content line survives (no text part exists to carry it) — exactly once
      expect(lines.filter(l => l === 'User: Please check the weather')).toHaveLength(1);
      // The tool result line is emitted — exactly once
      expect(lines.filter(l => l.startsWith('Tool Result getWeather:'))).toHaveLength(1);
    });

    it('should keep string content when no text part carries the same text', async () => {
      // Pins the equality rule in formatMessagesForTitle: `content` may only be
      // skipped when a text part carries the exact same text. A stored message can
      // legitimately have a content string that differs from its text parts
      // (AIV4Adapter uses m.content.content verbatim when set), and that text must
      // not be dropped.
      let capturedUserContent: any[] = [];

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const userMsg = options.prompt.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: 'Weather Check',
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const userMsg = options.prompt.find((msg: any) => msg.role === 'user');
            if (userMsg) {
              capturedUserContent = userMsg.content;
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: 'Weather Check',
              content: [{ type: 'text', text: 'Weather Check' }],
              warnings: [],
            };
          },
        });
      }

      const agent = new Agent({
        id: 'content-mismatch-agent',
        name: 'Content Mismatch Agent',
        instructions: 'You are a helpful assistant.',
        model: titleModel,
      });

      await agent.generateTitleFromUserMessage({
        messages: [
          {
            id: '1',
            role: 'user' as const,
            content: 'Please check the weather',
            parts: [{ type: 'text' as const, text: 'Paris' }],
          },
        ],
      });

      const textParts = capturedUserContent.filter((p: any) => p.type === 'text');
      const allText = textParts.map((p: any) => p.text).join('\n');
      const lines = allText.split('\n');

      // Both the distinct content and the text part are emitted — exactly once each
      expect(lines.filter(l => l === 'User: Please check the weather')).toHaveLength(1);
      expect(lines.filter(l => l === 'User: Paris')).toHaveLength(1);
    });

    it('should handle file parts after .ui() conversion uses url/mediaType (regression)', async () => {
      // Verify that MessageList.aiV5.ui() converts core-format file parts (data/mimeType)
      // into UI-format (url/mediaType), which is what generateTitleFromUserMessage
      // iterates over. The original bug was that the code read part.data/part.mimeType
      // on UI-format parts where those properties are undefined.
      const { MessageList } = await import('../../agent/message-list/message-list');
      const uiMessage = new MessageList()
        .add(
          {
            role: 'user',
            content: [
              { type: 'file' as const, data: 'data:image/png;base64,iVBOR', mimeType: 'image/png' },
              { type: 'text' as const, text: 'Describe this image' },
            ],
          },
          'user',
        )
        .get.all.aiV5.ui()
        .at(-1);

      expect(uiMessage).toBeDefined();
      const filePart = uiMessage!.parts.find((p: any) => p.type === 'file') as any;
      expect(filePart).toBeDefined();
      // UI format uses url/mediaType, not data/mimeType
      expect(filePart.url).toBeDefined();
      expect(filePart.mediaType).toBe('image/png');
    });
  });
}

titleGenerationTests('v1');
titleGenerationTests('v2');
