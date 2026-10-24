import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage';
import { Knowledge } from '../index';
import { createPinnedTools, DEFAULT_PINNED_MAX_TOKENS, MAX_PINNED_MAX_TOKENS } from '../pinned';

// tokenx estimates one token per short English word.
const words = (count: number) => 'word '.repeat(count).trimEnd();
const scope = ['org:acme', 'resource:user-1', 'thread:thread-1'];

describe('Knowledge limits are counted in tokens', () => {
  it('bounds the whole pin set by estimated tokens, not characters', async () => {
    const storage = new InMemoryStore({ id: 'pins' });
    const knowledge = new Knowledge({ storage });
    const host = {
      getKnowledgeStore: () => knowledge.getStorage(),
      getKnowledgeSemanticIndex: async () => undefined,
    };
    const tools = createPinnedTools(host, {
      scope,
      sourceThreadId: 'thread-1',
      maxPins: 20,
      maxTokens: 300,
    });
    const pin = (text: string) => tools.knowledge_pin!.execute!({ text } as never, {} as never);

    await pin(words(200));
    // 120 more tokens would bring the set to 320, over the 300-token budget.
    await expect(pin(words(120))).rejects.toThrow('about 300 tokens in total');
    // Long in characters but few tokens: still fits.
    await expect(pin('x'.repeat(400))).resolves.toBeDefined();
  });

  it('defaults pins to 500 tokens and refuses a budget over 2000', () => {
    expect(DEFAULT_PINNED_MAX_TOKENS).toBe(500);
    expect(() => new Knowledge({ pins: { maxTokens: MAX_PINNED_MAX_TOKENS + 1 } })).toThrow(
      'pins.maxTokens is at most 2000',
    );
    expect(new Knowledge({ pins: { maxTokens: MAX_PINNED_MAX_TOKENS } }).pinsEnabled).toBe(true);
  });
});
