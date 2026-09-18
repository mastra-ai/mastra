import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';

import { aiV5PromptToAIV6Prompt, aiV5PromptToAIV7Prompt } from './to-prompt';

function toolResultPrompt(parts: unknown[]): LanguageModelV2Prompt {
  return [
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'myTool',
          output: { type: 'content', value: parts },
        },
      ],
    },
  ] as unknown as LanguageModelV2Prompt;
}

function firstOutputValue(prompt: LanguageModelV2Prompt): unknown[] {
  const message = prompt[0] as unknown as { content: { output: { value: unknown[] } }[] };
  return message.content[0]!.output.value;
}

// Regression tests for #22618 — tool-result URL parts must survive the
// V2 → V3 / V2 → V4 spec-boundary prompt conversions with providerOptions intact.
describe('aiV5PromptToAIV6Prompt tool-result content', () => {
  it('converts Base64 media parts to image-data/file-data, preserving providerOptions', () => {
    const result = aiV5PromptToAIV6Prompt(
      toolResultPrompt([
        { type: 'media', data: 'aGVsbG8=', mediaType: 'image/png', providerOptions: { p: { keep: true } } },
        { type: 'media', data: 'aGVsbG8=', mediaType: 'application/pdf' },
      ]),
    );

    expect(firstOutputValue(result)).toEqual([
      { type: 'image-data', data: 'aGVsbG8=', mediaType: 'image/png', providerOptions: { p: { keep: true } } },
      { type: 'file-data', data: 'aGVsbG8=', mediaType: 'application/pdf' },
    ]);
  });

  it('passes image-url and file-url parts through untouched', () => {
    const imagePart = {
      type: 'image-url',
      url: 'https://example.com/radar.png',
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    };
    const filePart = { type: 'file-url', url: 'https://example.com/report.pdf' };

    const result = aiV5PromptToAIV6Prompt(toolResultPrompt([imagePart, filePart]));

    expect(firstOutputValue(result)[0]).toBe(imagePart);
    expect(firstOutputValue(result)[1]).toBe(filePart);
  });

  it('heals legacy media parts carrying a remote URL into image-url/file-url', () => {
    const result = aiV5PromptToAIV6Prompt(
      toolResultPrompt([
        {
          type: 'media',
          data: 'https://example.com/radar.png',
          mediaType: 'image/jpeg',
          providerOptions: { p: { keep: true } },
        },
        { type: 'media', data: 'https://example.com/report.pdf', mediaType: 'application/pdf' },
      ]),
    );

    expect(firstOutputValue(result)).toEqual([
      {
        type: 'image-url',
        url: 'https://example.com/radar.png',
        mediaType: 'image/jpeg',
        providerOptions: { p: { keep: true } },
      },
      { type: 'file-url', url: 'https://example.com/report.pdf', mediaType: 'application/pdf' },
    ]);
  });

  it('is idempotent when applied twice (llmPrompt selection + router V3 wrapper)', () => {
    const prompt = toolResultPrompt([
      { type: 'media', data: 'aGVsbG8=', mediaType: 'image/png' },
      { type: 'image-url', url: 'https://example.com/radar.png' },
    ]);

    const once = aiV5PromptToAIV6Prompt(prompt);
    const twice = aiV5PromptToAIV6Prompt(once);

    expect(firstOutputValue(twice)).toEqual(firstOutputValue(once));
  });
});

describe('aiV5PromptToAIV7Prompt tool-result content', () => {
  it('converts Base64 media parts to file parts with tagged data, preserving providerOptions', () => {
    const result = aiV5PromptToAIV7Prompt(
      toolResultPrompt([
        { type: 'media', data: 'aGVsbG8=', mediaType: 'image/png', providerOptions: { p: { keep: true } } },
      ]),
    );

    expect(firstOutputValue(result)).toEqual([
      {
        type: 'file',
        data: { type: 'data', data: 'aGVsbG8=' },
        mediaType: 'image/png',
        providerOptions: { p: { keep: true } },
      },
    ]);
  });

  it('converts image-url/file-url parts to file parts with tagged url data', () => {
    const result = aiV5PromptToAIV7Prompt(
      toolResultPrompt([
        { type: 'image-url', url: 'https://example.com/radar.png', providerOptions: { p: { keep: true } } },
        { type: 'file-url', url: 'https://example.com/report.pdf', mediaType: 'application/pdf' },
      ]),
    );

    expect(firstOutputValue(result)).toEqual([
      // mediaType is required on V4 file parts — defaulted for image parts.
      {
        type: 'file',
        data: { type: 'url', url: 'https://example.com/radar.png' },
        mediaType: 'image/jpeg',
        providerOptions: { p: { keep: true } },
      },
      { type: 'file', data: { type: 'url', url: 'https://example.com/report.pdf' }, mediaType: 'application/pdf' },
    ]);
  });

  it('defaults file-url parts without a mediaType to application/octet-stream', () => {
    const result = aiV5PromptToAIV7Prompt(toolResultPrompt([{ type: 'file-url', url: 'https://example.com/blob' }]));

    expect(firstOutputValue(result)).toEqual([
      { type: 'file', data: { type: 'url', url: 'https://example.com/blob' }, mediaType: 'application/octet-stream' },
    ]);
  });

  it('heals legacy media parts carrying a remote URL into url-tagged file parts', () => {
    const result = aiV5PromptToAIV7Prompt(
      toolResultPrompt([{ type: 'media', data: 'https://example.com/radar.png', mediaType: 'image/jpeg' }]),
    );

    expect(firstOutputValue(result)).toEqual([
      { type: 'file', data: { type: 'url', url: 'https://example.com/radar.png' }, mediaType: 'image/jpeg' },
    ]);
  });
});
