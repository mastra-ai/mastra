import { describe, expect, it } from 'vitest';
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
