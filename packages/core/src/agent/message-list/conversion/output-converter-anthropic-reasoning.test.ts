import { describe, expect, it } from 'vitest';
import type { AIV5Type } from '../types';
import { sanitizeV5UIMessages } from './output-converter';

/**
 * Tests for Anthropic reasoning (thinking block) stripping in sanitizeV5UIMessages.
 *
 * Anthropic thinking blocks contain cryptographic signatures that are model-specific
 * and ephemeral. Replaying them from thread history causes 'Invalid signature in
 * thinking block' errors. These parts are stripped when building a prompt TO the LLM
 * (filterIncompleteToolCalls=true) but preserved for UI display and DB storage.
 *
 * See: https://github.com/mastra-ai/mastra/issues/14559
 */
describe('sanitizeV5UIMessages — Anthropic reasoning stripping', () => {
  const makeMessage = (parts: AIV5Type.UIMessage['parts']): AIV5Type.UIMessage => ({
    id: 'msg-1',
    role: 'assistant',
    parts,
  });

  it('should strip Anthropic reasoning parts from LLM prompt', () => {
    const msg = makeMessage([
      {
        type: 'reasoning',
        reasoning: 'thinking...',
        providerMetadata: {
          anthropic: { signature: 'sig_abc123' },
        },
      } as AIV5Type.UIMessage['parts'][number],
      { type: 'text', text: 'Hello world' },
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0].parts).toHaveLength(1);
    expect(result[0].parts[0].type).toBe('text');
  });

  it('should preserve text parts alongside stripped reasoning', () => {
    const msg = makeMessage([
      {
        type: 'reasoning',
        reasoning: 'deep thought',
        providerMetadata: {
          anthropic: { signature: 'sig_xyz' },
        },
      } as AIV5Type.UIMessage['parts'][number],
      { type: 'text', text: 'The answer is 42' },
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0].parts).toHaveLength(1);
    expect(result[0].parts[0]).toMatchObject({ type: 'text', text: 'The answer is 42' });
  });

  it('should remove message entirely when only Anthropic reasoning parts remain', () => {
    const msg = makeMessage([
      {
        type: 'reasoning',
        reasoning: 'only thinking here',
        providerMetadata: {
          anthropic: { signature: 'sig_only' },
        },
      } as AIV5Type.UIMessage['parts'][number],
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(0);
  });

  it('should not strip reasoning parts without Anthropic providerMetadata', () => {
    const msg = makeMessage([
      {
        type: 'reasoning',
        reasoning: 'generic reasoning',
      } as AIV5Type.UIMessage['parts'][number],
      { type: 'text', text: 'response' },
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    // Both parts should be preserved
    expect(result[0].parts).toHaveLength(2);
    expect(result[0].parts[0].type).toBe('reasoning');
    expect(result[0].parts[1].type).toBe('text');
  });

  it('should strip both OpenAI and Anthropic reasoning parts from same message', () => {
    const msg = makeMessage([
      {
        type: 'reasoning',
        reasoning: 'anthropic thinking',
        providerMetadata: {
          anthropic: { signature: 'sig_abc' },
        },
      } as AIV5Type.UIMessage['parts'][number],
      {
        type: 'reasoning',
        reasoning: 'openai reasoning',
        providerMetadata: {
          openai: { itemId: 'rs_123' },
        },
      } as AIV5Type.UIMessage['parts'][number],
      { type: 'text', text: 'final response' },
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0].parts).toHaveLength(1);
    expect(result[0].parts[0].type).toBe('text');
  });

  it('should preserve Anthropic reasoning parts for UI display (filterIncompleteToolCalls=false)', () => {
    const msg = makeMessage([
      {
        type: 'reasoning',
        reasoning: 'thinking...',
        providerMetadata: {
          anthropic: { signature: 'sig_ui' },
        },
      } as AIV5Type.UIMessage['parts'][number],
      { type: 'text', text: 'response' },
    ]);

    const result = sanitizeV5UIMessages([msg], false);

    expect(result).toHaveLength(1);
    expect(result[0].parts).toHaveLength(2);
    expect(result[0].parts[0].type).toBe('reasoning');
  });
});
