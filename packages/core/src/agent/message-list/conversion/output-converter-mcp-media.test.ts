import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import type { AIV5Type } from '../types';
import { aiV5UIMessagesToAIV5ModelMessages } from './output-converter';
import { aiV5PromptToAIV6Prompt, aiV5PromptToAIV7Prompt } from './to-prompt';

// https://github.com/mastra-ai/mastra/issues/26481
describe('MCP image/audio tool results across model specification versions', () => {
  const buildMessages = (content: unknown[]) => {
    const output = { content };
    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-tool-ui',
        role: 'assistant',
        parts: [
          {
            type: 'tool-screenshot',
            toolCallId: 'call-mcp',
            state: 'output-available',
            input: {},
            output,
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
                toolCallId: 'call-mcp',
                toolName: 'screenshot',
                state: 'result',
                args: {},
                result: { content },
              },
            },
          ],
        },
      },
    ];
    return aiV5UIMessagesToAIV5ModelMessages(messages, dbMessages as any);
  };

  const toolResultOutput = (prompt: unknown[]) => {
    const toolMessage = (prompt as any[]).find(message => message.role === 'tool');
    return (toolMessage!.content as any[]).find(part => part.type === 'tool-result').output;
  };

  const mcpMediaContent = [
    { type: 'text', text: 'Screenshot captured' },
    { type: 'image', data: 'base64image', mimeType: 'image/png' },
    { type: 'audio', data: 'base64audio', mimeType: 'audio/mpeg' },
  ];

  it('emits V2 media parts in v5 model messages', () => {
    expect(toolResultOutput(buildMessages(mcpMediaContent))).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: 'Screenshot captured' },
        { type: 'media', data: 'base64image', mediaType: 'image/png' },
        { type: 'media', data: 'base64audio', mediaType: 'audio/mpeg' },
      ],
    });
  });

  it('translates to image-data/file-data for v6 (spec v3) models', () => {
    const prompt = aiV5PromptToAIV6Prompt(buildMessages(mcpMediaContent) as unknown as LanguageModelV2Prompt);
    expect(toolResultOutput(prompt)).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: 'Screenshot captured' },
        { type: 'image-data', data: 'base64image', mediaType: 'image/png' },
        { type: 'file-data', data: 'base64audio', mediaType: 'audio/mpeg' },
      ],
    });
  });

  it('translates to file parts for v7 (spec v4) models', () => {
    const prompt = aiV5PromptToAIV7Prompt(buildMessages(mcpMediaContent) as unknown as LanguageModelV2Prompt);
    expect(toolResultOutput(prompt)).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: 'Screenshot captured' },
        { type: 'file', data: { type: 'data', data: 'base64image' }, mediaType: 'image/png' },
        { type: 'file', data: { type: 'data', data: 'base64audio' }, mediaType: 'audio/mpeg' },
      ],
    });
  });

  it('keeps JSON output for MCP results without image or audio content', () => {
    const output = toolResultOutput(buildMessages([{ type: 'text', text: 'only text' }]));
    expect(output.type).toBe('json');
  });
});
