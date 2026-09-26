import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../state/types';
import type { AIV5Type } from '../types';
import { aiV5UIMessagesToAIV5ModelMessages } from './output-converter';
import { aiV5ModelMessageToV2PromptMessage, aiV5PromptToAIV6Prompt, aiV5PromptToAIV7Prompt } from './to-prompt';

/**
 * Tests that MCP-style tool results (`{ content: [...] }`) convert to `media`
 * parts — the only multimodal part type valid inside a
 * LanguageModelV2ToolResultOutput `content` value (`text` | `media`).
 *
 * `image-data`/`file-data` are spec-v3 (AI SDK v6) part shapes. Emitting them
 * at the v5 layer makes spec-v2 providers drop the image from the request, and
 * the spec-v4 translation (aiV5PromptToAIV7Prompt) only converts `media`
 * parts, so they would pass through unconverted there too.
 */
describe('aiV5UIMessagesToAIV5ModelMessages — MCP content media parts', () => {
  const makeMcpToolTurn = (result: unknown): { messages: AIV5Type.UIMessage[]; dbMessages: MastraDBMessage[] } => {
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
            output: result,
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
                result,
              },
            },
          ],
        },
      },
    ] as unknown as MastraDBMessage[];
    return { messages, dbMessages };
  };

  const getConvertedToolResult = (result: unknown) => {
    const { messages, dbMessages } = makeMcpToolTurn(result);
    const modelMessages = aiV5UIMessagesToAIV5ModelMessages(messages, dbMessages);
    const toolMessage = modelMessages.find(message => message.role === 'tool');
    const toolResult = (toolMessage!.content as any[]).find(part => part.type === 'tool-result');
    return toolResult;
  };

  it('converts MCP image content to media parts', () => {
    const toolResult = getConvertedToolResult({
      content: [
        { type: 'text', text: 'Screenshot captured' },
        { type: 'image', data: 'base64image', mimeType: 'image/png' },
      ],
    });

    expect(toolResult.output).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: 'Screenshot captured' },
        { type: 'media', data: 'base64image', mediaType: 'image/png' },
      ],
    });
  });

  it('converts MCP audio content to media parts', () => {
    const toolResult = getConvertedToolResult({
      content: [{ type: 'audio', data: 'base64audio', mimeType: 'audio/wav' }],
    });

    expect(toolResult.output).toEqual({
      type: 'content',
      value: [{ type: 'media', data: 'base64audio', mediaType: 'audio/wav' }],
    });
  });

  it('emits only text and media parts from the LanguageModelV2ToolResultOutput content union', () => {
    const toolResult = getConvertedToolResult({
      content: [
        { type: 'text', text: 'Screenshot captured' },
        { type: 'image', data: 'base64image', mimeType: 'image/png' },
        { type: 'audio', data: 'base64audio', mimeType: 'audio/wav' },
      ],
    });

    expect(toolResult.output.type).toBe('content');
    for (const part of toolResult.output.value) {
      expect(['text', 'media']).toContain(part.type);
    }
  });

  describe('spec translations of converted MCP media', () => {
    const buildPrompt = (result: unknown): LanguageModelV2Prompt => {
      const { messages, dbMessages } = makeMcpToolTurn(result);
      const modelMessages = aiV5UIMessagesToAIV5ModelMessages(messages, dbMessages);
      return modelMessages.map(aiV5ModelMessageToV2PromptMessage) as unknown as LanguageModelV2Prompt;
    };

    it('translates MCP image media to image-data for spec-v3 (v6) prompts', () => {
      const prompt = buildPrompt({
        content: [
          { type: 'text', text: 'Screenshot captured' },
          { type: 'image', data: 'base64image', mimeType: 'image/png' },
        ],
      });

      const v6Prompt = aiV5PromptToAIV6Prompt(prompt);
      const toolMessage = v6Prompt.find(m => m.role === 'tool');
      const toolResult = (toolMessage as any).content.find((p: any) => p.type === 'tool-result');

      expect(toolResult.output).toEqual({
        type: 'content',
        value: [
          { type: 'text', text: 'Screenshot captured' },
          { type: 'image-data', data: 'base64image', mediaType: 'image/png' },
        ],
      });
    });

    it('translates MCP image media to file content for spec-v4 (v7) prompts', () => {
      const prompt = buildPrompt({
        content: [
          { type: 'text', text: 'Screenshot captured' },
          { type: 'image', data: 'base64image', mimeType: 'image/png' },
        ],
      });

      const v7Prompt = aiV5PromptToAIV7Prompt(prompt);
      const toolMessage = v7Prompt.find(m => m.role === 'tool');
      const toolResult = (toolMessage as any).content.find((p: any) => p.type === 'tool-result');

      expect(toolResult.output).toEqual({
        type: 'content',
        value: [
          { type: 'text', text: 'Screenshot captured' },
          { type: 'file', data: { type: 'data', data: 'base64image' }, mediaType: 'image/png' },
        ],
      });
    });
  });
});
