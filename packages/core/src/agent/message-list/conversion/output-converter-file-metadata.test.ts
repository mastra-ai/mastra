import { describe, expect, it, vi } from 'vitest';
import type { AIV5Type } from '../types';
import { aiV5UIMessagesToAIV5ModelMessages } from './output-converter';

/**
 * Tests that providerMetadata on assistant file parts (e.g. Gemini's
 * thoughtSignature) survives the UI → Model message conversion.
 *
 * The vendored AI SDK v5 convertToModelMessages drops providerMetadata
 * from assistant file parts. restoreAssistantFileProviderMetadata
 * (called inside aiV5UIMessagesToAIV5ModelMessages) patches this.
 */
describe('aiV5UIMessagesToAIV5ModelMessages — assistant file providerMetadata', () => {
  const makeAssistantMessage = (parts: AIV5Type.UIMessage['parts']): AIV5Type.UIMessage => ({
    id: 'msg-assistant',
    role: 'assistant',
    parts,
  });

  const makeUserMessage = (text: string): AIV5Type.UIMessage => ({
    id: 'msg-user',
    role: 'user',
    parts: [{ type: 'text', text }],
  });

  it('preserves providerMetadata on a single assistant file part', () => {
    const thoughtSignature = 'abc123-signature';
    const messages: AIV5Type.UIMessage[] = [
      makeUserMessage('draw a cat'),
      makeAssistantMessage([
        { type: 'text', text: 'Here is a cat:' },
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'data:image/png;base64,iVBOR...',
          providerMetadata: {
            google: { thoughtSignature },
          },
        },
      ]),
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, []);
    const assistantMsg = result.find(m => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();

    const fileParts = (assistantMsg!.content as any[]).filter((p: any) => p.type === 'file');
    expect(fileParts).toHaveLength(1);
    expect(fileParts[0].providerOptions).toEqual({
      google: { thoughtSignature },
    });
  });

  it('preserves providerMetadata on multiple assistant file parts', () => {
    const messages: AIV5Type.UIMessage[] = [
      makeUserMessage('draw two images'),
      makeAssistantMessage([
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'data:image/png;base64,first...',
          providerMetadata: { google: { thoughtSignature: 'sig-1' } },
        },
        { type: 'text', text: 'And another:' },
        {
          type: 'file',
          mediaType: 'image/jpeg',
          url: 'data:image/jpeg;base64,second...',
          providerMetadata: { google: { thoughtSignature: 'sig-2' } },
        },
      ]),
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, []);
    const assistantMsg = result.find(m => m.role === 'assistant');
    const fileParts = (assistantMsg!.content as any[]).filter((p: any) => p.type === 'file');

    expect(fileParts).toHaveLength(2);
    expect(fileParts[0].providerOptions).toEqual({ google: { thoughtSignature: 'sig-1' } });
    expect(fileParts[1].providerOptions).toEqual({ google: { thoughtSignature: 'sig-2' } });
  });

  it('does not overwrite existing providerOptions on file parts', () => {
    // If the SDK ever fixes this upstream, our post-processing should not clobber
    const messages: AIV5Type.UIMessage[] = [
      makeUserMessage('hello'),
      makeAssistantMessage([
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'data:image/png;base64,abc...',
          providerMetadata: { google: { thoughtSignature: 'from-ui' } },
        },
      ]),
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, []);
    const assistantMsg = result.find(m => m.role === 'assistant');
    const fileParts = (assistantMsg!.content as any[]).filter((p: any) => p.type === 'file');

    // Should have providerOptions set (either from SDK or our restoration)
    expect(fileParts[0].providerOptions).toBeDefined();
  });

  it('leaves messages unchanged when no assistant file parts have providerMetadata', () => {
    const messages: AIV5Type.UIMessage[] = [
      makeUserMessage('hello'),
      makeAssistantMessage([
        { type: 'text', text: 'Hi there!' },
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'data:image/png;base64,abc...',
          // No providerMetadata
        },
      ]),
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, []);
    const assistantMsg = result.find(m => m.role === 'assistant');
    const fileParts = (assistantMsg!.content as any[]).filter((p: any) => p.type === 'file');

    expect(fileParts).toHaveLength(1);
    expect(fileParts[0].providerOptions).toBeUndefined();
  });

  it('handles multiple assistant messages with file parts across conversation', () => {
    const messages: AIV5Type.UIMessage[] = [
      makeUserMessage('draw a cat'),
      makeAssistantMessage([
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'data:image/png;base64,cat...',
          providerMetadata: { google: { thoughtSignature: 'cat-sig' } },
        },
      ]),
      makeUserMessage('now draw a dog'),
      makeAssistantMessage([
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'data:image/png;base64,dog...',
          providerMetadata: { google: { thoughtSignature: 'dog-sig' } },
        },
      ]),
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, []);
    const assistantMsgs = result.filter(m => m.role === 'assistant');
    expect(assistantMsgs).toHaveLength(2);

    const firstFile = (assistantMsgs[0].content as any[]).find((p: any) => p.type === 'file');
    const secondFile = (assistantMsgs[1].content as any[]).find((p: any) => p.type === 'file');

    expect(firstFile.providerOptions).toEqual({ google: { thoughtSignature: 'cat-sig' } });
    expect(secondFile.providerOptions).toEqual({ google: { thoughtSignature: 'dog-sig' } });
  });

  it('aligns metadata correctly when some file parts lack providerMetadata', () => {
    const messages: AIV5Type.UIMessage[] = [
      makeUserMessage('draw two images'),
      makeAssistantMessage([
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'data:image/png;base64,first...',
          // No providerMetadata on the first file part
        },
        {
          type: 'file',
          mediaType: 'image/jpeg',
          url: 'data:image/jpeg;base64,second...',
          providerMetadata: { google: { thoughtSignature: 'sig-2' } },
        },
      ]),
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, []);
    const assistantMsg = result.find(m => m.role === 'assistant');
    const fileParts = (assistantMsg!.content as any[]).filter((p: any) => p.type === 'file');

    expect(fileParts).toHaveLength(2);
    // First file had no metadata — should remain without providerOptions
    expect(fileParts[0].providerOptions).toBeUndefined();
    // Second file's metadata must land on the correct (second) part
    expect(fileParts[1].providerOptions).toEqual({ google: { thoughtSignature: 'sig-2' } });
  });
});

describe('aiV5UIMessagesToAIV5ModelMessages — MCP content tool result output', () => {
  it('bypasses MCP comparison for an ordinary 4 MiB JSON tool result', () => {
    const uiOutput = { data: 'x'.repeat(4 * 1024 * 1024) };
    const rawOutput = { data: 'x'.repeat(4 * 1024 * 1024) };
    const uiToJSON = vi.fn(() => {
      throw new Error('ordinary UI tool output must not be serialized for MCP detection');
    });
    const rawToJSON = vi.fn(() => {
      throw new Error('ordinary raw tool output must not be serialized for MCP detection');
    });
    Object.defineProperty(uiOutput, 'toJSON', { value: uiToJSON });
    Object.defineProperty(rawOutput, 'toJSON', { value: rawToJSON });

    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-tool-ui',
        role: 'assistant',
        parts: [
          {
            type: 'tool-large-result',
            toolCallId: 'call-large-result',
            state: 'output-available',
            input: {},
            output: uiOutput,
          } as any,
        ],
      },
    ];
    const dbMessages = [
      {
        id: 'msg-tool-db',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-large-result',
                toolName: 'largeResult',
                state: 'result',
                args: {},
                result: rawOutput,
              },
            },
          ],
        },
      },
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, dbMessages as any);
    const toolMessage = result.find(message => message.role === 'tool');
    const toolResult = (toolMessage!.content as any[]).find(part => part.type === 'tool-result');

    expect(toolResult.output.type).toBe('json');
    expect(toolResult.output.value).toBe(uiOutput);
    expect(uiToJSON).not.toHaveBeenCalled();
    expect(rawToJSON).not.toHaveBeenCalled();
  });

  it('converts structurally equal MCP text and media content without serializing it', () => {
    const createMcpOutput = () => ({
      content: [
        { type: 'text', text: 'Screenshot captured' },
        { type: 'image', data: 'base64image', mimeType: 'image/png' },
        { type: 'audio', data: 'base64audio', mimeType: 'audio/wav' },
      ],
    });
    const uiOutput = createMcpOutput();
    const rawOutput = createMcpOutput();
    const uiToJSON = vi.fn(() => {
      throw new Error('MCP UI tool output must not be serialized for comparison');
    });
    const rawToJSON = vi.fn(() => {
      throw new Error('MCP raw tool output must not be serialized for comparison');
    });
    Object.defineProperty(uiOutput, 'toJSON', { value: uiToJSON });
    Object.defineProperty(rawOutput, 'toJSON', { value: rawToJSON });

    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-tool-ui',
        role: 'assistant',
        parts: [
          {
            type: 'tool-screenshot',
            toolCallId: 'call-mcp-media',
            state: 'output-available',
            input: {},
            output: uiOutput,
          } as any,
        ],
      },
    ];
    const dbMessages = [
      {
        id: 'msg-tool-db',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-mcp-media',
                toolName: 'screenshot',
                state: 'result',
                args: {},
                result: rawOutput,
              },
            },
          ],
        },
      },
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, dbMessages as any);
    const toolMessage = result.find(message => message.role === 'tool');
    const toolResult = (toolMessage!.content as any[]).find(part => part.type === 'tool-result');

    expect(toolResult.output).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: 'Screenshot captured' },
        { type: 'image-data', data: 'base64image', mediaType: 'image/png' },
        { type: 'file-data', data: 'base64audio', mediaType: 'audio/wav' },
      ],
    });
    expect(uiToJSON).not.toHaveBeenCalled();
    expect(rawToJSON).not.toHaveBeenCalled();
  });

  it('does not inspect raw MCP results for non-JSON custom output', () => {
    const circularContentPart: Record<string, unknown> = { type: 'resource' };
    circularContentPart.self = circularContentPart;
    const rawOutput = {
      content: [circularContentPart, { type: 'image', data: 'base64data', mimeType: 'image/png' }],
    };

    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-tool-ui',
        role: 'assistant',
        parts: [
          {
            type: 'tool-screenshot',
            toolCallId: 'call-mcp-image',
            state: 'output-available',
            input: {},
            output: { type: 'text', value: 'Explicit summary wins' },
          } as any,
        ],
      },
    ];

    const dbMessages = [
      {
        id: 'msg-tool-db',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-mcp-image',
                toolName: 'screenshot',
                state: 'result',
                args: {},
                result: rawOutput,
              },
            },
          ],
        },
      },
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, dbMessages as any);
    const toolMessage = result.find(message => message.role === 'tool');
    const toolResult = (toolMessage!.content as any[]).find(part => part.type === 'tool-result');

    expect(toolResult.output).toEqual({ type: 'text', value: 'Explicit summary wins' });
  });

  it('preserves JSON output when MCP content conversion cannot serialize a content part', () => {
    const circularContentPart: Record<string, unknown> = { type: 'resource' };
    circularContentPart.self = circularContentPart;
    const rawOutput = {
      content: [circularContentPart, { type: 'image', data: 'base64data', mimeType: 'image/png' }],
    };

    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-tool-ui',
        role: 'assistant',
        parts: [
          {
            type: 'tool-screenshot',
            toolCallId: 'call-circular-mcp-image',
            state: 'output-available',
            input: {},
            output: rawOutput,
          } as any,
        ],
      },
    ];

    const dbMessages = [
      {
        id: 'msg-tool-db',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-circular-mcp-image',
                toolName: 'screenshot',
                state: 'result',
                args: {},
                result: rawOutput,
              },
            },
          ],
        },
      },
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, dbMessages as any);
    const toolMessage = result.find(message => message.role === 'tool');
    const toolResult = (toolMessage!.content as any[]).find(part => part.type === 'tool-result');

    expect(toolResult.output.type).toBe('json');
    expect(toolResult.output.value).toBe(rawOutput);
  });

  it('preserves JSON output when distinct circular MCP results cannot be structurally compared', () => {
    const createCircularMcpOutput = () => {
      const image: Record<string, unknown> = {
        type: 'image',
        data: 'base64data',
        mimeType: 'image/png',
      };
      image.self = image;
      return { content: [image] };
    };
    const uiOutput = createCircularMcpOutput();
    const rawOutput = createCircularMcpOutput();

    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-tool-ui',
        role: 'assistant',
        parts: [
          {
            type: 'tool-screenshot',
            toolCallId: 'call-circular-mcp-comparison',
            state: 'output-available',
            input: {},
            output: uiOutput,
          } as any,
        ],
      },
    ];
    const dbMessages = [
      {
        id: 'msg-tool-db',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-circular-mcp-comparison',
                toolName: 'screenshot',
                state: 'result',
                args: {},
                result: rawOutput,
              },
            },
          ],
        },
      },
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, dbMessages as any);
    const toolMessage = result.find(message => message.role === 'tool');
    const toolResult = (toolMessage!.content as any[]).find(part => part.type === 'tool-result');

    expect(toolResult.output.type).toBe('json');
    expect(toolResult.output.value).toBe(uiOutput);
  });

  it('preserves explicit JSON output that is structurally equal to the raw MCP result', () => {
    const createMcpOutput = () => ({
      content: [
        { type: 'text', text: 'raw text' },
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
      ],
    });
    const uiOutput = createMcpOutput();
    const rawOutput = createMcpOutput();

    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-tool-ui',
        role: 'assistant',
        parts: [
          {
            type: 'tool-screenshot',
            toolCallId: 'call-explicit-json',
            state: 'output-available',
            input: {},
            output: uiOutput,
          } as any,
        ],
      },
    ];

    const dbMessages = [
      {
        id: 'msg-tool-db',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-explicit-json',
                toolName: 'screenshot',
                state: 'result',
                args: {},
                result: rawOutput,
              },
              providerMetadata: {
                mastra: {
                  modelOutput: { type: 'json', value: uiOutput },
                },
              },
            },
          ],
        },
      },
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, dbMessages as any);
    const toolMessage = result.find(message => message.role === 'tool');
    const toolResult = (toolMessage!.content as any[]).find(part => part.type === 'tool-result');

    expect(toolResult.output.type).toBe('json');
    expect(toolResult.output.value).toBe(uiOutput);
  });
});
