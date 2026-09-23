import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const githubCopilotStorage = {
  reload: vi.fn(),
  getOAuthCredential: vi.fn(),
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
    githubCopilotStorage.getOAuthCredential.mockReset();
  });

  afterEach(async () => {
    const { clearCopilotCatalogCache } = await import('../github-copilot.js');
    clearCopilotCatalogCache();
    vi.resetModules();
  });

  it('returns an empty list when there is no Copilot OAuth credential', async () => {
    githubCopilotStorage.getOAuthCredential.mockResolvedValue(undefined);

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const models = await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

    expect(models).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an empty list when the credential is not OAuth', async () => {
    githubCopilotStorage.getOAuthCredential.mockResolvedValue({ type: 'api_key', key: 'sk-x' });

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const models = await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

    expect(models).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to getApiKey when the store has no OAuth snapshot API', async () => {
    // Deployed per-tenant stores implement only the required CredentialStore
    // surface. Returning [] here would make Copilot models vanish from the
    // catalog for those callers even though a usable token exists.
    const deployedStore = {
      reload: vi.fn(),
      get: vi.fn(() => ({
        type: 'oauth',
        access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
        refresh: 'ghu_x',
        expires: Date.now() + 60_000,
      })),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async () => 'tid=deployed;proxy-ep=proxy.individual.githubcopilot.com;'),
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: 'gpt-4.1', capabilities: { supports: { tool_calls: true } }, model_picker_enabled: true }],
      }),
    );

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const models = await getCopilotModelCatalog({ authStorage: deployedStore as any });

    expect(deployedStore.getApiKey).toHaveBeenCalledWith('github-copilot');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(models.map(m => m.id)).toContain('gpt-4.1');
  });

  it('returns an empty list when the fallback store has no token', async () => {
    const deployedStore = {
      reload: vi.fn(),
      get: vi.fn(() => undefined),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async () => undefined),
    };

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const models = await getCopilotModelCatalog({ authStorage: deployedStore as any });

    expect(models).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keys the fallback catalog by the store active account so a rotation re-fetches', async () => {
    // A rotation-capable deployed store has no `getOAuthCredential` but does
    // expose its registry. Entitlements are per account, so the cache entry for
    // the first account must not answer for the second after a rotation.
    let activeAccountId = 'github-copilot:tenant-a';
    const deployedStore = {
      reload: vi.fn(),
      get: vi.fn(() => ({
        type: 'oauth',
        access: 'tid=a;exp=9999999999;',
        refresh: 'ghu_a',
        expires: Date.now() + 60_000,
      })),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async () => `tid=${activeAccountId};exp=9999999999;`),
      listAccounts: vi.fn(() => []),
      getActiveAccount: vi.fn(() => ({ id: activeAccountId })),
      activateAccount: vi.fn(),
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'model-a', model_picker_enabled: true }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'model-b', model_picker_enabled: true }] }));

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const first = await getCopilotModelCatalog({ authStorage: deployedStore as any });
    activeAccountId = 'github-copilot:tenant-b';
    const second = await getCopilotModelCatalog({ authStorage: deployedStore as any });

    expect(first.map(model => model.id)).toEqual(['model-a']);
    expect(second.map(model => model.id)).toEqual(['model-b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0]![1].headers as Record<string, string>).Authorization).toContain('tenant-a');
    expect((fetchMock.mock.calls[1]![1].headers as Record<string, string>).Authorization).toContain('tenant-b');
  });

  it('does not file a fetched catalog under an account that rotated mid-fetch', async () => {
    // A rotation can land while the token fetch is awaiting (a refresh that
    // switches the active account). Reading the registry again *after* that
    // await names a different account than the token just returned, so the
    // entry gets filed under the new account and answers for it — the same
    // wrong-entitlements delivery, narrowed to a race rather than removed.
    let activeAccountId = 'github-copilot:tenant-a';
    let tokenRequested!: () => void;
    let releaseToken!: () => void;
    const tokenReached = new Promise<void>(resolve => {
      tokenRequested = resolve;
    });
    const tokenGate = new Promise<void>(resolve => {
      releaseToken = resolve;
    });
    const deployedStore = {
      reload: vi.fn(),
      get: vi.fn(() => ({
        type: 'oauth',
        access: 'tid=x;exp=9999999999;',
        refresh: 'ghu_a',
        expires: Date.now() + 60_000,
      })),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async () => {
        const served = activeAccountId;
        if (served === 'github-copilot:tenant-a') {
          tokenRequested();
          await tokenGate;
        }
        return `tid=${served};exp=9999999999;`;
      }),
      listAccounts: vi.fn(() => []),
      getActiveAccount: vi.fn(() => ({ id: activeAccountId })),
      activateAccount: vi.fn(),
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'model-a', model_picker_enabled: true }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'model-b', model_picker_enabled: true }] }));

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const first = getCopilotModelCatalog({ authStorage: deployedStore as any });
    await tokenReached;
    activeAccountId = 'github-copilot:tenant-b';
    releaseToken();
    const firstModels = await first;

    // The identity was not stable across the token fetch, so nothing knew which
    // account this belonged to and the TTL cache must stay out of it.
    expect((fetchMock.mock.calls[0]![1].headers as Record<string, string>).Authorization).toContain('tenant-a');
    expect(firstModels.map(model => model.id)).toEqual(['model-a']);

    const second = await getCopilotModelCatalog({ authStorage: deployedStore as any });

    expect(second.map(model => model.id)).toEqual(['model-b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1]![1].headers as Record<string, string>).Authorization).toContain('tenant-b');
  });

  it('does not TTL-cache the fallback catalog when the store cannot name its account', async () => {
    // With no account identity the cache cannot be made credential-distinct, so
    // caching would serve whatever account came first to every later one. The
    // store is expected to be single-credential here; a fetch per call is the
    // price of never returning another account's models.
    const deployedStore = {
      reload: vi.fn(),
      get: vi.fn(() => undefined),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async () => 'tid=deployed;proxy-ep=proxy.individual.githubcopilot.com;'),
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'model-a', model_picker_enabled: true }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'model-b', model_picker_enabled: true }] }));

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const first = await getCopilotModelCatalog({ authStorage: deployedStore as any });
    const second = await getCopilotModelCatalog({ authStorage: deployedStore as any });

    expect(first.map(model => model.id)).toEqual(['model-a']);
    expect(second.map(model => model.id)).toEqual(['model-b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not share one in-flight fetch across accounts of a store that cannot name them', async () => {
    // An unnamed store is exactly the one that rotates inside the credential read,
    // so its id is not stable across the await and cannot key anything. Two
    // overlapping callers then both come up unidentified: a shared in-flight
    // promise would hand the second the first one's models. The first request is
    // held open so the overlap is forced rather than left to request timing.
    let activeAccountId = 'github-copilot:tenant-a';
    let releaseToken: () => void;
    const tokenGate = new Promise<void>(resolve => {
      releaseToken = resolve;
    });
    let tokenRequested: () => void;
    const firstTokenRequested = new Promise<void>(resolve => {
      tokenRequested = resolve;
    });
    const deployedStore = {
      reload: vi.fn(),
      get: vi.fn(() => undefined),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async () => {
        const served = activeAccountId;
        if (served === 'github-copilot:tenant-a') {
          tokenRequested!();
          await tokenGate;
        }
        // A rotation lands inside the credential read, which is what makes the
        // identity unavailable to this caller.
        activeAccountId = served === 'github-copilot:tenant-a' ? 'github-copilot:tenant-b' : 'github-copilot:tenant-c';
        return `tid=${served};proxy-ep=proxy.individual.githubcopilot.com;`;
      }),
      listAccounts: vi.fn(() => []),
      getActiveAccount: vi.fn(() => ({ id: activeAccountId })),
      activateAccount: vi.fn(),
    };
    let releaseFirstFetch: (r: Response) => void;
    const firstFetchDeferred = new Promise<Response>(resolve => {
      releaseFirstFetch = resolve;
    });
    let releaseSecondFetch: (r: Response) => void;
    const secondFetchDeferred = new Promise<Response>(resolve => {
      releaseSecondFetch = resolve;
    });
    let firstFetchStarted: () => void;
    const fetchStarted = new Promise<void>(resolve => {
      firstFetchStarted = resolve;
    });
    let secondFetchStarted = false;
    let fetchCount = 0;
    fetchMock.mockImplementation(() => {
      fetchCount += 1;
      if (fetchCount === 1) {
        firstFetchStarted!();
        return firstFetchDeferred;
      }
      secondFetchStarted = true;
      return secondFetchDeferred;
    });

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const first = getCopilotModelCatalog({ authStorage: deployedStore as any });
    await firstTokenRequested;
    releaseToken!();
    await fetchStarted;
    const second = getCopilotModelCatalog({ authStorage: deployedStore as any });
    // Let the second caller reach its decision point while the first request is
    // still open: sharing would mean it never issues one of its own.
    await new Promise(resolve => setTimeout(resolve, 0));

    releaseFirstFetch!(jsonResponse({ data: [{ id: 'model-a', model_picker_enabled: true }] }));
    if (secondFetchStarted) {
      releaseSecondFetch!(jsonResponse({ data: [{ id: 'model-b', model_picker_enabled: true }] }));
    }

    const [a, b] = await Promise.all([first, second]);

    expect(secondFetchStarted).toBe(true);
    expect(a.map(model => model.id)).toEqual(['model-a']);
    expect(b.map(model => model.id)).toEqual(['model-b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0]![1].headers as Record<string, string>).Authorization).toContain('tenant-a');
    expect((fetchMock.mock.calls[1]![1].headers as Record<string, string>).Authorization).toContain('tenant-b');
  });

  it('fetches /models against the proxy-ep base URL with the bearer token', async () => {
    githubCopilotStorage.getOAuthCredential.mockResolvedValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
    });
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
    githubCopilotStorage.getOAuthCredential.mockResolvedValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
      // A real snapshot names its account; the cache is keyed by that identity.
      accountInstanceId: 'github-copilot:test-account',
    });
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

  it('shares the inflight fetch across concurrent callers of one account', async () => {
    githubCopilotStorage.getOAuthCredential.mockResolvedValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
      // Sharing is only safe once the account is known — see the unnamed-store case below.
      accountInstanceId: 'github-copilot:test-account',
    });

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
    githubCopilotStorage.getOAuthCredential.mockResolvedValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
    });
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
    githubCopilotStorage.getOAuthCredential.mockResolvedValue({
      type: 'oauth',
      access: 'tid=test;exp=9999999999;', // no proxy-ep
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
      enterpriseUrl: 'company.ghe.com',
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://copilot-api.company.ghe.com/models');
  });

  it('does not reuse credentials or cached models after an account switch', async () => {
    githubCopilotStorage.getOAuthCredential
      .mockResolvedValueOnce({
        type: 'oauth',
        access: 'tid=account-a;exp=9999999999;',
        refresh: 'ghu_a',
        expires: Date.now() + 60_000,
        accountInstanceId: 'github-copilot:account-a',
      })
      .mockResolvedValueOnce({
        type: 'oauth',
        access: 'tid=account-b;exp=9999999999;',
        refresh: 'ghu_b',
        expires: Date.now() + 60_000,
        accountInstanceId: 'github-copilot:account-b',
      });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'model-a', model_picker_enabled: true }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'model-b', model_picker_enabled: true }] }));

    const { getCopilotModelCatalog } = await import('../github-copilot.js');
    const first = await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });
    const second = await getCopilotModelCatalog({ authStorage: githubCopilotStorage as any });

    expect(first.map(model => model.id)).toEqual(['model-a']);
    expect(second.map(model => model.id)).toEqual(['model-b']);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.individual.githubcopilot.com/models',
      'https://api.individual.githubcopilot.com/models',
    ]);
    expect((fetchMock.mock.calls[0]![1].headers as Record<string, string>).Authorization).toContain('account-a');
    expect((fetchMock.mock.calls[1]![1].headers as Record<string, string>).Authorization).toContain('account-b');
  });
});
