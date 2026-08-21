import { describe, expect, it } from 'vitest';

import { webSearchLinks } from './web-search';

describe('webSearchLinks', () => {
  it('keeps the pages out of an Anthropic result and drops its encrypted payload', () => {
    const links = webSearchLinks([
      {
        type: 'web_search_result',
        url: 'https://mastra.ai/docs',
        title: 'Mastra docs',
        pageAge: '2 days',
        encryptedContent: 'x'.repeat(5000),
      },
    ]);

    expect(links).toEqual([{ url: 'https://mastra.ai/docs', title: 'Mastra docs' }]);
  });

  it('reads OpenAI sources and skips the ones with no page behind them', () => {
    expect(
      webSearchLinks({
        action: { type: 'search', query: 'mastra' },
        sources: [
          { type: 'url', url: 'https://mastra.ai' },
          { type: 'api', name: 'internal' },
        ],
      }),
    ).toEqual([{ url: 'https://mastra.ai', title: undefined }]);
  });

  it('falls back to the page the model opened when the result carries no sources', () => {
    const url = 'https://github.com/mastra-ai/mastra/pull/21870';
    expect(webSearchLinks({ action: { type: 'openPage', url } })).toEqual([{ url }]);
  });

  it('has nothing to link to for a Tavily string result', () => {
    expect(webSearchLinks('## Title\nhttps://mastra.ai\nbody')).toEqual([]);
  });
});
