import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';

import { stripInternalPromptMetadata } from './strip-internal-prompt-metadata';

const toolResult = (providerOptions?: Record<string, unknown>) =>
  ({
    type: 'tool-result',
    toolCallId: 'call-1',
    toolName: 'search',
    output: { type: 'text', value: 'compact result' },
    ...(providerOptions ? { providerOptions } : {}),
  }) as unknown as LanguageModelV2Prompt[number]['content'];

const promptWith = (...parts: unknown[]): LanguageModelV2Prompt =>
  [{ role: 'tool', content: parts }] as unknown as LanguageModelV2Prompt;

const firstPart = (prompt: LanguageModelV2Prompt) => prompt[0]!.content[0] as Record<string, any>;

describe('stripInternalPromptMetadata', () => {
  it('removes the mastra modelOutput marker from tool results', () => {
    const prompt = promptWith(toolResult({ mastra: { modelOutput: { type: 'text', value: 'compact result' } } }));

    stripInternalPromptMetadata(prompt);

    expect(firstPart(prompt).providerOptions).toBeUndefined();
    expect(JSON.stringify(prompt)).not.toContain('modelOutput');
  });

  it('keeps sibling mastra options and other provider namespaces', () => {
    const prompt = promptWith(
      toolResult({
        mastra: { modelOutput: { type: 'text', value: 'compact result' }, modelOutputComputed: true },
        openai: { itemId: 'item-1' },
      }),
    );

    stripInternalPromptMetadata(prompt);

    expect(firstPart(prompt).providerOptions).toEqual({
      mastra: { modelOutputComputed: true },
      openai: { itemId: 'item-1' },
    });
  });

  it('leaves tool results without the marker untouched', () => {
    const part = toolResult({ openai: { itemId: 'item-1' } });
    const prompt = promptWith(part);

    stripInternalPromptMetadata(prompt);

    expect(firstPart(prompt)).toBe(part);
  });

  it('ignores parts that are not tool parts', () => {
    const textPart = { type: 'text', text: 'search result:\ncompact result' };
    const prompt = promptWith(textPart);

    stripInternalPromptMetadata(prompt);

    expect(firstPart(prompt)).toEqual(textPart);
  });

  it('also removes the marker from assistant tool-call parts', () => {
    const prompt = promptWith({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'search',
      input: { query: 'transformers' },
      providerOptions: { mastra: { modelOutput: { type: 'text', value: 'compact result' }, createdAt: 1 } },
    });

    stripInternalPromptMetadata(prompt);

    expect(firstPart(prompt).providerOptions).toEqual({ mastra: { createdAt: 1 } });
  });

  it('returns the prompt it was given', () => {
    const prompt = promptWith(toolResult({ mastra: { modelOutput: 'compact' } }));

    expect(stripInternalPromptMetadata(prompt)).toBe(prompt);
  });
});
