import type { CoreUserMessage } from '@mastra/core/llm';
import { describe, expect, it } from 'vitest';
import { createUserMessage } from './user-message';

describe('createUserMessage', () => {
  describe.each(['providerOptions', 'experimental_providerMetadata'] as const)(
    'when attachments have message-level %s',
    optionsKey => {
      it('preserves the options on their parts, giving part-level settings precedence', () => {
        const attachments: CoreUserMessage[] = [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: 'https://files.example.com/diagram.png',
                [optionsKey]: { openai: { imageDetail: 'high' } },
              },
            ],
            [optionsKey]: { openai: { imageDetail: 'low', custom: true }, other: { enabled: true } },
          },
          {
            role: 'user',
            content: '<attachment name="notes.txt">Review the proposal.</attachment>',
            [optionsKey]: { anthropic: { cacheControl: { type: 'ephemeral' } } },
          },
        ];
        const original = structuredClone(attachments);

        expect(createUserMessage('Review these files', attachments).content).toMatchObject([
          { type: 'text', text: 'Review these files' },
          {
            type: 'image',
            image: 'https://files.example.com/diagram.png',
            providerOptions: { openai: { imageDetail: 'high', custom: true }, other: { enabled: true } },
          },
          {
            type: 'text',
            text: '<attachment name="notes.txt">Review the proposal.</attachment>',
            providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
          },
        ]);
        expect(attachments).toEqual(original);
      });
    },
  );
});
