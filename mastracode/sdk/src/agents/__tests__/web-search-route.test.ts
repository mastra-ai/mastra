import { rmSync } from 'node:fs';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Point app data at a temp dir before any module builds the global auth storage,
// so these tests never read or write a real auth.json.
const appDataDir = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? '/tmp'}/mastracode-web-search-${process.pid}-${Date.now()}`;
  process.env.MASTRA_APP_DATA_DIR = dir;
  return dir;
});

vi.mock('../../tools/index.js', () => ({
  createConfiguredWebTools: () => undefined,
  hasParallelKey: () => false,
  hasTavilyKey: () => false,
  requestSandboxAccessTool: { description: 'request sandbox access' },
}));

import type { CredentialStore } from '../../auth/types.js';
import { getAppDataDir } from '../../utils/project.js';
import { setCredentialStoreProvider } from '../credential-resolver.js';
import { getDynamicInstructions } from '../instructions.js';
import { getGlobalAuthStorage, reloadAuthStorage } from '../mastracode-gateway.js';
import { resolveModel, resolveProviderWebSearchRoute } from '../model.js';
import { buildFullPrompt } from '../prompts/index.js';
import { createDynamicTools } from '../tools.js';

const promptContext = {
  projectPath: '/tmp/project',
  projectName: 'test-project',
  modeId: 'build',
  currentDate: '2026-03-23',
  workingDir: '/tmp/project',
  platform: 'linux',
  date: '2026-03-23',
  mode: 'build',
};

function requestContextFor(modelId: string): RequestContext {
  const requestContext = new RequestContext();
  requestContext.set('controller', {
    modeId: 'build',
    getState: () => ({}),
    session: { modelId, state: { get: () => ({}) } },
  });
  return requestContext;
}

/** Runs one agent turn with the model and tools mastracode builds, returning the first request sent. */
async function firstRequest(modelId: string): Promise<{ url: string; body: any }> {
  const requests: { url: string; body: any }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      // OAuth fetch wrappers forward a Request with a streamed body.
      const text = typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.text() : '';
      if (text) requests.push({ url, body: JSON.parse(text) });
      // Only the request matters; a client error ends the turn without retries.
      return new Response(JSON.stringify({ error: { message: 'stubbed' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  const requestContext = requestContextFor(modelId);
  const agent = new Agent({
    id: 'web-search-wire',
    name: 'web-search-wire',
    instructions: 'Search the web.',
    model: resolveModel(modelId, { requestContext }),
    tools: await createDynamicTools()({ requestContext }),
  });
  await agent.generate('Find the latest release notes.', { requestContext, maxRetries: 0 }).catch(() => {});
  expect(requests.length).toBeGreaterThan(0);
  return requests[0]!;
}

function signInWithOAuth(credentialId: 'anthropic' | 'openai-codex') {
  getGlobalAuthStorage().set(credentialId, {
    type: 'oauth',
    access: `${credentialId}-access`,
    refresh: `${credentialId}-refresh`,
    expires: Date.now() + 24 * 60 * 60 * 1000,
    ...(credentialId === 'openai-codex' ? { accountId: 'account-1' } : {}),
  } as any);
  reloadAuthStorage();
}

describe('provider web search follows the model transport', () => {
  beforeEach(() => {
    expect(getAppDataDir()).toBe(appDataDir);
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-test');
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', '');
  });

  afterEach(() => {
    const storage = getGlobalAuthStorage();
    storage.remove('anthropic');
    storage.remove('openai-codex');
    reloadAuthStorage();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    rmSync(appDataDir, { recursive: true, force: true });
  });

  describe('Mastra gateway alias with a gateway key', () => {
    beforeEach(() => {
      vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk-test');
    });

    it.each(['mastra/openai/gpt-5.5', 'mastra/anthropic/claude-sonnet-4-5'])(
      'sends OpenRouter web search to the gateway chat endpoint for %s',
      async modelId => {
        expect(resolveProviderWebSearchRoute(modelId)).toBe('mastra-gateway');
        expect(buildFullPrompt({ ...promptContext, modelId })).toContain('**web_search**');

        const { url, body } = await firstRequest(modelId);
        expect(url).toMatch(/\/v1\/chat\/completions$/);
        expect(body.tools).toContainEqual({ type: 'openrouter:web_search' });
        expect(JSON.stringify(body.tools)).not.toMatch(/openai:web_search|anthropic:web_search/);
      },
    );

    it('keeps native Anthropic search for a Claude OAuth sign-in', async () => {
      signInWithOAuth('anthropic');
      const modelId = 'mastra/anthropic/claude-sonnet-4-5';
      expect(resolveProviderWebSearchRoute(modelId)).toBe('anthropic');
      expect(buildFullPrompt({ ...promptContext, modelId })).toContain('**web_search**');

      const { url, body } = await firstRequest(modelId);
      expect(url).toMatch(/\/v1\/messages/);
      expect(body.tools).toContainEqual(expect.objectContaining({ type: 'web_search_20250305', name: 'web_search' }));
    });

    it('keeps native OpenAI search for a Codex OAuth sign-in', async () => {
      signInWithOAuth('openai-codex');
      const modelId = 'mastra/openai/gpt-5.5';
      expect(resolveProviderWebSearchRoute(modelId)).toBe('openai');
      expect(buildFullPrompt({ ...promptContext, modelId })).toContain('**web_search**');

      const { url, body } = await firstRequest(modelId);
      expect(url).toMatch(/\/responses$/);
      expect(body.tools).toContainEqual(expect.objectContaining({ type: 'web_search' }));
    });
  });

  it.each([
    ['anthropic/claude-sonnet-4-5', 'anthropic', /api\.anthropic\.com\/v1\/messages/, 'web_search_20250305'],
    ['openai/gpt-5.5', 'openai', /api\.openai\.com\/v1\/responses/, 'web_search'],
    ['mastra/anthropic/claude-sonnet-4-5', 'anthropic', /api\.anthropic\.com\/v1\/messages/, 'web_search_20250305'],
    ['mastra/openai/gpt-5.5', 'openai', /api\.openai\.com\/v1\/responses/, 'web_search'],
  ])('sends native search for %s without a gateway key', async (modelId, route, urlPattern, toolType) => {
    expect(resolveProviderWebSearchRoute(modelId)).toBe(route);
    expect(buildFullPrompt({ ...promptContext, modelId })).toContain('**web_search**');

    const { url, body } = await firstRequest(modelId);
    expect(url).toMatch(urlPattern);
    expect(body.tools).toContainEqual(expect.objectContaining({ type: toolType }));
  });

  describe('deployed Factory with tenant credentials', () => {
    beforeEach(() => {
      vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk-test');
    });

    afterEach(() => {
      setCredentialStoreProvider(undefined);
    });

    function useTenantCredentials(credentialType: 'oauth' | 'api_key') {
      const tenantStore: CredentialStore = {
        allowEnvironmentFallback: false,
        reload() {},
        get: providerId =>
          providerId === 'anthropic'
            ? credentialType === 'oauth'
              ? ({
                  type: 'oauth',
                  access: 'tenant-access',
                  refresh: 'tenant-refresh',
                  expires: Date.now() + 60_000,
                } as any)
              : { type: 'api_key', key: 'sk-tenant' }
            : undefined,
        getStoredApiKey: () => undefined,
        getApiKey: async () => undefined,
      };
      setCredentialStoreProvider(
        () => tenantStore,
        async () => ({ userId: 'user-1', orgId: 'org-1', credentialScope: 'factory' }),
      );
    }

    function tenantRequestContext(modelId: string): RequestContext {
      const requestContext = requestContextFor(modelId);
      requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
      return requestContext;
    }

    it.each([
      ['oauth', 'anthropic.web_search_20250305'],
      ['api_key', 'openrouter.web_search'],
    ] as const)('routes search from the tenant %s credential before the model runs', async (credentialType, toolId) => {
      useTenantCredentials(credentialType);
      const modelId = 'mastra/anthropic/claude-sonnet-4-5';

      // Tools and instructions are built before model resolution prepares its own context.
      const tools = await createDynamicTools()({ requestContext: tenantRequestContext(modelId) });
      expect(tools.web_search?.id).toBe(toolId);

      const instructions = await getDynamicInstructions({ requestContext: tenantRequestContext(modelId) });
      expect(instructions).toContain('**web_search** — Search the web');
    });

    it("routes search through the gateway on the tenant's own gateway key", async () => {
      vi.stubEnv('MASTRA_GATEWAY_API_KEY', '');
      const tenantStore: CredentialStore = {
        allowEnvironmentFallback: false,
        reload() {},
        get: () => undefined,
        getStoredApiKey: providerId => (providerId === 'mastra-gateway' ? 'msk_tenant' : undefined),
        getApiKey: async () => undefined,
      };
      setCredentialStoreProvider(
        () => tenantStore,
        async () => ({ userId: 'user-1', orgId: 'org-1', credentialScope: 'factory' }),
      );
      const modelId = 'mastra/anthropic/claude-sonnet-4-5';

      const tools = await createDynamicTools()({ requestContext: tenantRequestContext(modelId) });
      expect(tools.web_search?.id).toBe('openrouter.web_search');
    });
  });

  it('offers no provider search for other providers', () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk-test');
    expect(resolveProviderWebSearchRoute('mastra/google/gemini-2.5-flash')).toBeUndefined();
    expect(buildFullPrompt({ ...promptContext, modelId: 'mastra/google/gemini-2.5-flash' })).not.toContain(
      '**web_search**',
    );
  });
});
