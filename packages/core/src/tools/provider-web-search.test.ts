import { describe, expect, it } from 'vitest';

import { isWebSearchToolName, webSearchAction, webSearchLinks, webSearchTarget } from './provider-web-search';

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

    expect(links).toEqual([{ url: 'https://mastra.ai/docs', title: 'Mastra docs', pageAge: '2 days' }]);
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
    ).toEqual([{ url: 'https://mastra.ai', title: undefined, pageAge: undefined }]);
  });

  it('falls back to the page the model opened when the result carries no sources', () => {
    const url = 'https://github.com/mastra-ai/mastra/pull/21870';
    expect(webSearchLinks({ action: { type: 'openPage', url } })).toEqual([{ url }]);
  });

  it('has nothing to link to for a Tavily string result', () => {
    expect(webSearchLinks('## Title\nhttps://mastra.ai\nbody')).toEqual([]);
  });
});

describe('webSearchAction', () => {
  it('keeps an action kind it has never seen, with whatever it aimed at', () => {
    const action = webSearchAction({ action: { type: 'screenshot', url: 'https://mastra.ai' } });

    expect(action).toMatchObject({ type: 'screenshot', url: 'https://mastra.ai' });
    expect(webSearchTarget(action!)).toBe('https://mastra.ai');
  });

  it('prefers the query, then the pattern, then the page', () => {
    expect(webSearchTarget({ type: 'search', query: 'mastra', url: 'https://mastra.ai' })).toBe('mastra');
    expect(webSearchTarget({ type: 'findInPage', pattern: 'loop', url: 'https://mastra.ai' })).toBe('loop');
    expect(webSearchTarget({ type: 'openPage', url: 'https://mastra.ai' })).toBe('https://mastra.ai');
  });
});

describe('isWebSearchToolName', () => {
  it('covers the dated name providers give their own tool', () => {
    expect(isWebSearchToolName('web_search')).toBe(true);
    expect(isWebSearchToolName('web_search_20250305')).toBe(true);
    expect(isWebSearchToolName('web_extract')).toBe(false);
  });
});
