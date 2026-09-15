import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateEdgeConfigAlias } from './alias';

describe('updateEdgeConfigAlias', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('upserts the key with the fresh sandbox URL', async () => {
    await updateEdgeConfigAlias({
      edgeConfigId: 'ecfg_abc',
      key: 'agent-url',
      token: 'tok',
      url: 'https://sbx-123.example',
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.vercel.com/v1/edge-config/ecfg_abc/items');
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({
      items: [{ operation: 'upsert', key: 'agent-url', value: 'https://sbx-123.example' }],
    });
  });

  it('scopes the request to a team when configured', async () => {
    await updateEdgeConfigAlias({
      edgeConfigId: 'ecfg_abc',
      key: 'k',
      token: 'tok',
      teamId: 'team_1',
      url: 'https://x',
    });

    expect(String(fetchMock.mock.calls[0]![0])).toContain('teamId=team_1');
  });

  it('throws when no token is provided', async () => {
    await expect(
      updateEdgeConfigAlias({ edgeConfigId: 'ecfg_abc', key: 'k', token: '', url: 'https://x' }),
    ).rejects.toThrow(/Vercel API token/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces API failures with status and body', async () => {
    fetchMock.mockResolvedValue(new Response('forbidden', { status: 403 }));

    await expect(
      updateEdgeConfigAlias({ edgeConfigId: 'ecfg_abc', key: 'k', token: 'tok', url: 'https://x' }),
    ).rejects.toThrow(/403.*forbidden/s);
  });
});
