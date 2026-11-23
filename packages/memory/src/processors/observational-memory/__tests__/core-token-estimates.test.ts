import type { MastraDBMessage } from '@mastra/core/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Part = MastraDBMessage['content']['parts'][number];

const text = 'Hiring slows in Q3 while the budget holds steady across teams. '.repeat(20);
const STALE = 99_999;

/** A message whose text part carries a v9 count that is wrong for its content, as a stale one would be. */
function staleMessage(): MastraDBMessage {
  const part = {
    type: 'text',
    text,
    providerMetadata: {
      mastra: { tokenEstimate: { 'trusted:text': { v: 9, source: 'v9:tokenx', key: 'trusted:text', tokens: STALE } } },
    },
  } as Part;
  return { id: 'm1', role: 'assistant', createdAt: new Date(0), content: { format: 2, parts: [part] } };
}

function entriesOf(message: MastraDBMessage) {
  const estimate = (message.content.parts[0] as any).providerMetadata?.mastra?.tokenEstimate ?? {};
  return ('source' in estimate ? [estimate] : Object.values(estimate)) as { v: number; tokens: number }[];
}

afterEach(() => {
  vi.doUnmock('@mastra/core/agent/message-list');
  vi.resetModules();
});

describe('Memory with an older @mastra/core (no token estimate clearers)', () => {
  async function loadWithOldCore() {
    vi.resetModules();
    vi.doMock('@mastra/core/agent/message-list', async importOriginal => {
      const actual = await importOriginal<Record<string, unknown>>();
      const { clearTokenEstimates: _a, clearTokenEstimatesInPlace: _b, ...older } = actual;
      return older;
    });
    const clearers = await import('../core-token-estimates');
    const { TokenCounter } = await import('../token-counter');
    return { clearers, TokenCounter };
  }

  it('detects support from the exported clearers', async () => {
    const { clearers } = await loadWithOldCore();
    expect(clearers.coreClearsTokenEstimates).toBe(false);

    vi.doUnmock('@mastra/core/agent/message-list');
    vi.resetModules();
    expect((await import('../core-token-estimates')).coreClearsTokenEstimates).toBe(true);
  });

  it('does not reuse a stored v9 count and counts from the content, like a Memory without v9', async () => {
    const { TokenCounter } = await loadWithOldCore();
    const fresh = new TokenCounter().countMessage({
      ...staleMessage(),
      content: { format: 2, parts: [{ type: 'text', text }] },
    });
    const msg = staleMessage();
    const counted = new TokenCounter().countMessage(msg);
    expect(counted).toBe(fresh);
    expect(counted).toBeLessThan(STALE);
    // It stays on the hash-validated v8 path: nothing new is written as v9.
    expect(
      entriesOf(msg)
        .filter(entry => entry.v === 9)
        .map(entry => entry.tokens),
    ).toEqual([STALE]);
    expect(entriesOf(msg).some(entry => entry.v === 8)).toBe(true);
  });

  it('does not clear anything itself, because Core cannot have stored counts it trusts', async () => {
    const { clearers } = await loadWithOldCore();
    const part = staleMessage().content.parts[0]!;
    expect(clearers.clearTokenEstimates(part)).toBe(part);
  });

  it('with a Core that has the clearers, a stored v9 count is read back as stored', async () => {
    vi.resetModules();
    const { TokenCounter } = await import('../token-counter');
    const msg = staleMessage();
    const counted = new TokenCounter().countMessage(msg);
    expect(counted).toBeGreaterThan(STALE);
  });
});
