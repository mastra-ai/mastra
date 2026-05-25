import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const githubCopilotStorage = {
  reload: vi.fn(),
  get: vi.fn(),
  getApiKey: vi.fn(),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getCopilotModelCatalog', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    githubCopilotStorage.reload.mockReset();
    githubCopilotStorage.get.mockReset();
    githubCopilotStorage.getApiKey.mockReset();
  });

  afterEach(async () => {
    const { clearCopilotCatalogCache } = await import('../github-copilot.js');
    clearCopilotCatalogCache();
    vi.resetModules();
  });

  it('returns an empty list when there is no Copilot OAuth credential', async () => {
    githubCopilotStorage.get.mockReturnValue(undefined);

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const models = await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

    expect(models).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an empty list when the credential is not OAuth', async () => {
    githubCopilotStorage.get.mockReturnValue({ type: 'api_key', key: 'sk-x' });

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const models = await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

    expect(models).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches /models against the proxy-ep base URL with the bearer token', async () => {
    githubCopilotStorage.get.mockReturnValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
    });
    githubCopilotStorage.getApiKey.mockResolvedValue('tid=test;proxy-ep=proxy.individual.githubcopilot.com;');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: 'claude-sonnet-4.5',
            name: 'Claude Sonnet 4.5',
            vendor: 'Anthropic',
            model_picker_enabled: true,
            capabilities: { family: 'claude', limits: {}, supports: { tool_calls: true, streaming: true } },
          },
          {
            id: 'gpt-4.1',
            name: 'GPT-4.1',
            vendor: 'OpenAI',
            model_picker_enabled: true,
            capabilities: { family: 'gpt-4.1', limits: {}, supports: { tool_calls: true, streaming: true } },
          },
        ],
      }),
    );

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const models = await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.individual.githubcopilot.com/models');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
    );
    expect(models.map(m => m.id).sort()).toEqual(['claude-sonnet-4.5', 'gpt-4.1']);
  });

  it('caches the model list across calls (single fetch within TTL)', async () => {
    githubCopilotStorage.get.mockReturnValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
    });
    githubCopilotStorage.getApiKey.mockResolvedValue('tid=test;proxy-ep=proxy.individual.githubcopilot.com;');
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'claude-sonnet-4.5',
            name: 'Claude Sonnet 4.5',
            model_picker_enabled: true,
            capabilities: { family: 'claude', limits: {}, supports: { tool_calls: true, streaming: true } },
          },
        ],
      }),
    );

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const a = await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });
    const b = await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('shares the inflight fetch across concurrent callers', async () => {
    githubCopilotStorage.get.mockReturnValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
    });
    githubCopilotStorage.getApiKey.mockResolvedValue('tid=test;proxy-ep=proxy.individual.githubcopilot.com;');

    let resolveFetch: (r: Response) => void;
    const fetchDeferred = new Promise<Response>(resolve => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValueOnce(fetchDeferred);

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const promiseA = getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });
    const promiseB = getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

    resolveFetch!(
      jsonResponse({
        data: [
          {
            id: 'claude-sonnet-4.5',
            name: 'Claude Sonnet 4.5',
            model_picker_enabled: true,
            capabilities: { family: 'claude', limits: {}, supports: { tool_calls: true, streaming: true } },
          },
        ],
      }),
    );

    const [a, b] = await Promise.all([promiseA, promiseB]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('falls back to the hard-coded model list when the fetch fails', async () => {
    githubCopilotStorage.get.mockReturnValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
    });
    githubCopilotStorage.getApiKey.mockResolvedValue('tid=test;proxy-ep=proxy.individual.githubcopilot.com;');
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403, statusText: 'Forbidden' }));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const { getCopilotModelCatalog } = await import('../github-copilot.js');
      const models = await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

      // The fallback only includes OpenAI-compatible models — Anthropic-shaped
      // Claude wouldn't work through the current `/chat/completions` adapter.
      expect(models.map(m => m.id)).toEqual(['gpt-4.1']);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('honors the enterprise base URL when proxy-ep is absent', async () => {
    githubCopilotStorage.get.mockReturnValue({
      type: 'oauth',
      access: 'tid=test;exp=9999999999;', // no proxy-ep
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
      enterpriseUrl: 'company.ghe.com',
    });
    githubCopilotStorage.getApiKey.mockResolvedValue('tid=test;exp=9999999999;');
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://copilot-api.company.ghe.com/models');
  });
});
