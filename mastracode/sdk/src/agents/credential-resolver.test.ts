import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuthCredential, CredentialStore } from '../auth/types.js';
import {
  hasCredentialStoreProvider,
  resolveCredentialStore,
  resolveTenantFromRequestContext,
  setCredentialStoreProvider,
} from './credential-resolver.js';
import { MastraCodeGateway } from './mastracode-gateway.js';

function fakeStore(data: Record<string, AuthCredential>): CredentialStore {
  return {
    reload: () => {},
    get: provider => data[provider],
    getStoredApiKey: provider => {
      const cred = data[provider];
      return cred?.type === 'api_key' ? cred.key : undefined;
    },
    getApiKey: async provider => {
      const cred = data[provider];
      if (!cred) return undefined;
      return cred.type === 'api_key' ? cred.key : cred.access;
    },
  };
}

afterEach(() => {
  setCredentialStoreProvider(undefined);
});

describe('credential store provider registry', () => {
  it('reports no provider by default', () => {
    expect(hasCredentialStoreProvider()).toBe(false);
    expect(resolveCredentialStore(new RequestContext())).toBeUndefined();
  });

  it('resolves the tenant store when a provider and authenticated user exist', () => {
    const store = fakeStore({});
    let seenTenant: unknown;
    setCredentialStoreProvider(tenant => {
      seenTenant = tenant;
      return store;
    });
    expect(hasCredentialStoreProvider()).toBe(true);

    const ctx = new RequestContext();
    ctx.set('user', { workosId: 'user_1', id: 'prov_1', organizationId: 'org_1' });

    expect(resolveCredentialStore(ctx)).toBe(store);
    expect(seenTenant).toEqual({ orgId: 'org_1', userId: 'user_1' });
  });

  it('fails closed without an authenticated tenant on the request context', async () => {
    setCredentialStoreProvider(() => fakeStore({}));
    const withoutContext = resolveCredentialStore(undefined);
    const emptyContext = resolveCredentialStore(new RequestContext());

    expect(withoutContext).toMatchObject({ allowEnvironmentFallback: false });
    expect(emptyContext).toBe(withoutContext);
    await expect(withoutContext?.getApiKey('anthropic')).resolves.toBeUndefined();
  });

  it('fails closed when the tenant store provider cannot resolve a store', async () => {
    setCredentialStoreProvider(() => undefined);
    const ctx = new RequestContext();
    ctx.set('user', { workosId: 'user_1', organizationId: 'org_1' });

    const store = resolveCredentialStore(ctx);
    expect(store).toMatchObject({ allowEnvironmentFallback: false });
    await expect(store?.getApiKey('anthropic')).resolves.toBeUndefined();
  });

  it('falls back to the provider id when workosId is absent', () => {
    const ctx = new RequestContext();
    ctx.set('user', { id: 'prov_2' });
    expect(resolveTenantFromRequestContext(ctx)).toEqual({ orgId: undefined, userId: 'prov_2' });
  });

  it('ignores malformed user values', () => {
    const ctx = new RequestContext();
    ctx.set('user', 'not-a-user');
    expect(resolveTenantFromRequestContext(ctx)).toBeUndefined();
  });
});

describe('gateway credentialStore injection', () => {
  const gatewayOptions = {
    mastraGatewayBaseUrl: 'https://gateway.example.com',
    routeThroughMastraGateway: false,
  };

  it('resolves auth from the injected store instead of the global AuthStorage', () => {
    const gateway = new MastraCodeGateway({
      ...gatewayOptions,
      credentialStore: fakeStore({ anthropic: { type: 'api_key', key: 'tenant-key' } }),
    });

    const auth = gateway.resolveAuth({
      gatewayId: 'mastracode',
      providerId: 'anthropic',
      modelId: 'claude-opus-4-6',
      routerId: 'mastracode/anthropic/claude-opus-4-6',
    });
    expect(auth).toEqual({ apiKey: 'tenant-key', source: 'gateway' });
  });

  it('reports the oauth marker when the injected store holds an OAuth credential', () => {
    const gateway = new MastraCodeGateway({
      ...gatewayOptions,
      credentialStore: fakeStore({
        'openai-codex': { type: 'oauth', refresh: 'r', access: 'a', expires: Date.now() + 60_000 },
      }),
    });

    const auth = gateway.resolveAuth({
      gatewayId: 'mastracode',
      providerId: 'openai',
      modelId: 'gpt-5.2-codex',
      routerId: 'mastracode/openai/gpt-5.2-codex',
    });
    expect(auth).toEqual({ bearerToken: 'oauth', source: 'gateway' });
  });

  it('returns undefined from the injected store when the tenant has no credential', () => {
    const gateway = new MastraCodeGateway({
      ...gatewayOptions,
      credentialStore: fakeStore({}),
    });

    const auth = gateway.resolveAuth({
      gatewayId: 'mastracode',
      providerId: 'xai',
      modelId: 'grok-4',
      routerId: 'mastracode/xai/grok-4',
    });
    expect(auth).toBeUndefined();
  });

  it('getApiKey resolves the tenant credential for the model provider', async () => {
    const gateway = new MastraCodeGateway({
      ...gatewayOptions,
      credentialStore: fakeStore({ xai: { type: 'api_key', key: 'tenant-xai-key' } }),
    });
    await expect(gateway.getApiKey('xai/grok-4')).resolves.toBe('tenant-xai-key');
  });
});
