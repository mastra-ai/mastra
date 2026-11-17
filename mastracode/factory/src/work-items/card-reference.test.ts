import { describe, expect, it } from 'vitest';

import { cardCarries, isSourceReference, sourceKeyFromReference } from './card-reference.js';

// The keys the provider adapters store on a card's sources (see ./providers), for what people paste.
describe('the issue or pull request a pasted reference names', () => {
  it.each([
    ['https://github.com/mastra-ai/mastra/pull/30578', 'mastra-ai/mastra#30578'],
    ['https://github.com/mastra-ai/mastra/pull/30578/files#diff-abc', 'mastra-ai/mastra#30578'],
    ['https://github.com/mastra-ai/mastra/issues/12#issuecomment-1', 'mastra-ai/mastra#12'],
    ['http://github.example.com/acme/app/pull/3?tab=checks', 'acme/app#3'],
    ['mastra-ai/platform#5001', 'mastra-ai/platform#5001'],
    ['https://gitlab.com/acme/platform/api/-/merge_requests/7/diffs', 'acme/platform/api!7'],
    ['https://gitlab.example.com/acme/api/-/issues/3', 'acme/api#3'],
    ['acme/platform/api!7', 'acme/platform/api!7'],
    ['https://linear.app/acme/issue/ENG-42/fix-the-login-page', 'ENG-42'],
    ['https://acme.atlassian.net/browse/OPS-3', 'OPS-3'],
    ['ENG-42', 'ENG-42'],
  ])('%s → %s', (reference, key) => {
    expect(sourceKeyFromReference(reference)).toBe(key);
    expect(isSourceReference(reference)).toBe(true);
  });

  it.each(['review this', '#12', '12', 'not-an-id', 'https://github.com/mastra-ai/mastra', 'mastra-ai/mastra'])(
    'names no issue or pull request: %s',
    reference => expect(sourceKeyFromReference(reference)).toBeNull(),
  );

  it("matches a card's source by key whatever the link's case, and other links by the link itself", () => {
    const card = {
      workItem: {
        sources: [
          { key: 'Mastra-AI/Mastra#12', url: 'https://github.com/Mastra-AI/Mastra/issues/12' },
          { key: null, url: 'https://tracker.example.com/tickets/9/' },
        ],
      },
    };
    expect(cardCarries(card, 'https://github.com/mastra-ai/mastra/issues/12')).toBe(true);
    expect(cardCarries(card, 'https://github.com/mastra-ai/mastra/issues/13')).toBe(false);
    expect(cardCarries(card, 'https://tracker.example.com/tickets/9?from=slack')).toBe(true);
    expect(cardCarries(card, 'https://tracker.example.com/tickets/10')).toBe(false);
  });
});
