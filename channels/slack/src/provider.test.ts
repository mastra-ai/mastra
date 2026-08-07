import { describe, it, expect } from 'vitest';

import { SlackProvider, stripTrailingSlash } from './provider';

describe('connect object form', () => {
  it('requires a name when connecting without an agent id', async () => {
    const provider = new SlackProvider();
    await expect(
      // @ts-expect-error deliberately omitting the required name to exercise the runtime guard
      provider.connect({ id: 'controller-1' }),
    ).rejects.toThrow(/"name" is required/);
  });
});

describe('stripTrailingSlash', () => {
  it('removes a single trailing slash', () => {
    expect(stripTrailingSlash('https://mastra-demo.calebbarnes.ca/')).toBe('https://mastra-demo.calebbarnes.ca');
  });

  it('removes multiple trailing slashes', () => {
    expect(stripTrailingSlash('https://example.com///')).toBe('https://example.com');
  });

  it('leaves a URL without a trailing slash unchanged', () => {
    expect(stripTrailingSlash('https://example.com')).toBe('https://example.com');
  });

  it('preserves path segments and only strips the trailing slash', () => {
    expect(stripTrailingSlash('https://example.com/base/')).toBe('https://example.com/base');
  });

  it('produces a clean OAuth callback URL when joined', () => {
    const baseUrl = stripTrailingSlash('https://mastra-demo.calebbarnes.ca/');
    expect(`${baseUrl}/slack/oauth/callback`).toBe('https://mastra-demo.calebbarnes.ca/slack/oauth/callback');
  });
});
