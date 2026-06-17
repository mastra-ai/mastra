import { describe, expect, it } from 'vitest';

import { aiV4CoreMessageToV1PromptMessage, aiV5ModelMessageToV2PromptMessage } from './to-prompt';

describe('aiV4CoreMessageToV1PromptMessage image conversion', () => {
  it('converts raw base64 image strings to Uint8Array for provider prompts', () => {
    const base64Image = Buffer.from([1, 2, 3, 4]).toString('base64');

    const result = aiV4CoreMessageToV1PromptMessage({
      role: 'user',
      content: [{ type: 'image', image: base64Image, mimeType: 'image/png' }],
    });

    expect(result.role).toBe('user');
    expect(result.content[0]).toMatchObject({
      type: 'image',
      mimeType: 'image/png',
    });
    expect(result.content[0].image).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.content[0].image as Uint8Array)).toEqual([1, 2, 3, 4]);
  });
});

describe('aiV5ModelMessageToV2PromptMessage tool-name sanitization', () => {
  it('sanitizes invalid tool names in tool-call parts', () => {
    const result = aiV5ModelMessageToV2PromptMessage({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: '$FUNCTION_NAME',
          input: { query: 'test' },
        },
      ],
    });

    expect(result.role).toBe('assistant');
    expect(result.content[0]).toMatchObject({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'unknown_tool',
    });
  });

  it('sanitizes invalid tool names in tool-result parts', () => {
    const result = aiV5ModelMessageToV2PromptMessage({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: '$FUNCTION_NAME',
          output: { ok: true },
        },
      ],
    });

    expect(result.role).toBe('tool');
    expect(result.content[0]).toMatchObject({
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'unknown_tool',
    });
  });
});
