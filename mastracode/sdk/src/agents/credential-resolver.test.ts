import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthCredential, CredentialStore } from '../auth/types.js';
import {
  credentialTenantFailureReason,
  hasCredentialStoreProvider,
  prepareCredentialTenant,
  withCredentialTenantPreparation,
  resolveCredentialStore,
  resolveTenantFromRequestContext,
  setCredentialLogger,
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
    expect(seenTenant).toEqual({ orgId: 'org_1', userId: 'user_1', credentialScope: 'user' });
  });

  it('fails closed without an authenticated tenant on the request context', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    setCredentialStoreProvider(() => fakeStore({}));
    const withoutContext = resolveCredentialStore(undefined);
    const emptyContext = resolveCredentialStore(new RequestContext());

    expect(withoutContext).toMatchObject({ allowEnvironmentFallback: false });
    expect(emptyContext).toBe(withoutContext);
    await expect(withoutContext?.getApiKey('anthropic')).resolves.toBeUndefined();
    expect(warn).toHaveBeenNthCalledWith(1, '[MastraCode] Tenant credential resolution failed closed', {
      reason: 'missing-user-context',
      hasRequestContext: false,
    });
    expect(warn).toHaveBeenNthCalledWith(2, '[MastraCode] Tenant credential resolution failed closed', {
      reason: 'missing-user-context',
      hasRequestContext: true,
    });
    warn.mockRestore();
  });

  it('logs failures through a registered logger', () => {
    const error = vi.fn();
    setCredentialLogger({ error });
    try {
      setCredentialStoreProvider(() => fakeStore({}));
      resolveCredentialStore(new RequestContext());
      expect(error).toHaveBeenCalledWith('[MastraCode] Tenant credential resolution failed closed', {
        reason: 'missing-user-context',
        hasRequestContext: true,
      });
    } finally {
      setCredentialLogger(undefined);
    }
  });

  it('fails closed when the tenant store provider cannot resolve a store', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    setCredentialStoreProvider(() => undefined);
    const ctx = new RequestContext();
    ctx.set('user', { workosId: 'user_1', organizationId: 'org_1' });

    const store = resolveCredentialStore(ctx);
    expect(store).toMatchObject({ allowEnvironmentFallback: false });
    await expect(store?.getApiKey('anthropic')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[MastraCode] Tenant credential resolution failed closed', {
      reason: 'credential-store-unavailable',
      hasOrganization: true,
      credentialScope: 'user',
      ownerResolved: true,
    });
    warn.mockRestore();
  });

  it('falls back to the provider id when workosId is absent', () => {
    const ctx = new RequestContext();
    ctx.set('user', { id: 'prov_2' });
    expect(resolveTenantFromRequestContext(ctx)).toEqual({
      orgId: undefined,
      userId: 'prov_2',
      credentialScope: 'user',
    });
  });

  it('reads a session-shaped user, whose org lives on the session half', () => {
    const ctx = new RequestContext();
    ctx.set('user', { session: { activeOrganizationId: 'org_1' }, user: { id: 'prov_3' } });
    expect(resolveTenantFromRequestContext(ctx)).toEqual({
      orgId: 'org_1',
      userId: 'prov_3',
      credentialScope: 'user',
    });
  });

  it('takes a session-shaped user org from the session half only, never the inner user', () => {
    const ctx = new RequestContext();
    ctx.set('user', { session: {}, user: { id: 'prov_4', organizationId: 'org_9' } });
    // `toFactoryAuthUser` in `@mastra/factory` reads the session half and nothing
    // else. Falling back to the inner user here would resolve a tenant the
    // Factory refuses, and the two would disagree about who the caller is.
    expect(resolveTenantFromRequestContext(ctx)).toEqual({
      orgId: undefined,
      userId: 'prov_4',
      credentialScope: 'user',
    });
  });

  it.each(['factory', 'user'] as const)('ignores client-writable %s scope and identity', credentialScope => {
    const ctx = new RequestContext();
    ctx.set('user', { workosId: 'user_1', organizationId: 'org_1' });
    ctx.set('controller', {
      state: {
        factoryProjectId: 'project-1',
        factoryModelScope: credentialScope,
        factoryOwnerUserId: 'victim',
        factoryOrgId: 'foreign-org',
      },
    });
    expect(resolveTenantFromRequestContext(ctx)).toEqual({
      orgId: 'org_1',
      userId: 'user_1',
      credentialScope: 'user',
    });
  });

  it('accepts only host-resolved policy and passes it to cloned subagent contexts', async () => {
    const tenant = { orgId: 'org_1', userId: 'owner', credentialScope: 'user' as const };
    setCredentialStoreProvider(
      () => fakeStore({}),
      async () => tenant,
    );
    const ctx = new RequestContext();
    ctx.set('user', { workosId: 'sender', organizationId: 'org_1' });
    ctx.set('mastracode__credentialPolicy', tenant);
    expect(resolveTenantFromRequestContext(ctx)).toBeUndefined();
    await prepareCredentialTenant(ctx);
    expect(resolveTenantFromRequestContext(ctx)).toEqual(tenant);
    const clone = new RequestContext(ctx.entries());
    expect(resolveTenantFromRequestContext(clone)).toEqual(tenant);
    const roundTripped = new RequestContext(JSON.parse(JSON.stringify([...ctx.entries()])));
    expect(resolveTenantFromRequestContext(roundTripped)).toBeUndefined();
  });

  it('binds a primed principal context to its session and preserves that origin in forked contexts', async () => {
    const resolve = vi.fn(async () => ({ orgId: 'org_1', userId: 'owner', credentialScope: 'factory' as const }));
    setCredentialStoreProvider(() => undefined, resolve);
    const principal = new RequestContext();
    principal.set('user', { id: 'user_1', organizationId: 'org_1' });
    await prepareCredentialTenant(principal);
    const session = new RequestContext(principal.entries());
    session.set('controller', { resourceId: 'session-1', threadId: 'thread-1' });
    await prepareCredentialTenant(session);
    expect(resolve).toHaveBeenLastCalledWith(session);
    const fork = new RequestContext(session.entries());
    fork.set('controller', { resourceId: 'session-1', threadId: 'fork-thread' });
    await prepareCredentialTenant(fork);
    expect(resolve).toHaveBeenLastCalledWith(session);
    expect(resolveTenantFromRequestContext(fork)).toEqual({
      orgId: 'org_1',
      userId: 'owner',
      credentialScope: 'factory',
    });
  });

  it('refreshes policy for each invocation and invalidates it when lookup fails', async () => {
    const factory = { orgId: 'org_1', userId: 'owner', credentialScope: 'factory' as const };
    const user = { ...factory, credentialScope: 'user' as const };
    const resolver = vi
      .fn()
      .mockResolvedValueOnce(factory)
      .mockResolvedValueOnce(user)
      .mockRejectedValueOnce(new Error('database unavailable'));
    setCredentialStoreProvider(() => fakeStore({}), resolver);
    const ctx = new RequestContext();
    const resolve = vi.fn(({ requestContext }) => resolveTenantFromRequestContext(requestContext));
    const model = withCredentialTenantPreparation(resolve);
    await expect(model({ requestContext: ctx })).resolves.toEqual(factory);
    await expect(model({ requestContext: ctx })).resolves.toEqual(user);
    await expect(model({ requestContext: ctx })).rejects.toThrow('database unavailable');
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolveTenantFromRequestContext(ctx)).toBeUndefined();
  });

  it('retains the trusted origin during concurrent preparations of a stripped context', async () => {
    const tenant = { orgId: 'org_1', userId: 'owner', credentialScope: 'factory' as const };
    const resolver = vi.fn(async (_context: RequestContext) => tenant);
    setCredentialStoreProvider(() => fakeStore({}), resolver);
    const parent = new RequestContext();
    parent.set('controller', { resourceId: 'session-1', threadId: 'thread-1' });
    await prepareCredentialTenant(parent);
    const child = new RequestContext(parent.entries());
    child.set('controller', { resourceId: '', threadId: null });
    let finishLookup = () => {};
    const pendingLookup = new Promise<typeof tenant>(resolve => {
      finishLookup = () => resolve(tenant);
    });
    resolver.mockReturnValueOnce(pendingLookup);
    const pending = prepareCredentialTenant(child);
    await prepareCredentialTenant(child);
    expect(resolver.mock.calls.slice(1).map(([source]) => source)).toEqual([parent, parent]);
    finishLookup();
    await pending;
    expect(resolveTenantFromRequestContext(child)).toEqual(tenant);
  });

  it('fails closed when required host policy is absent, even with a valid principal', async () => {
    const provider = vi.fn(() => fakeStore({}));
    setCredentialStoreProvider(provider, async () => undefined);
    const ctx = new RequestContext();
    ctx.set('user', { id: 'sender', organizationId: 'org_1' });
    await expect(prepareCredentialTenant(ctx)).rejects.toThrow('could not be resolved');
    await expect(resolveCredentialStore(ctx)?.getApiKey('openai')).resolves.toBeUndefined();
    expect(provider).not.toHaveBeenCalled();
    await expect(prepareCredentialTenant()).rejects.toThrow('requires a request context');
  });

  it('says why tenant resolution failed and logs non-secret diagnostics', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      setCredentialStoreProvider(
        () => fakeStore({}),
        async () => undefined,
      );
      const anonymous = new RequestContext();
      anonymous.set('controller', { resourceId: 'session-1', threadId: 'thread-1' });
      await expect(prepareCredentialTenant(anonymous)).rejects.toThrow(
        'could not be resolved: the request has no authenticated user.',
      );
      expect(warn).toHaveBeenLastCalledWith(
        expect.stringContaining('could not be resolved'),
        expect.objectContaining({
          reason: 'missing-user-context',
          hasUser: false,
          hasControllerResource: true,
          hasControllerThread: true,
          resourceId: 'session-1',
          threadId: 'thread-1',
          contextKeys: expect.arrayContaining(['controller']),
          stack: expect.stringContaining('prepareCredentialTenant'),
        }),
      );

      const authenticated = new RequestContext();
      authenticated.set('user', { id: 'sender', organizationId: 'org_1' });
      await expect(prepareCredentialTenant(authenticated)).rejects.toThrow(
        'could not be resolved: no credential policy applies to this request.',
      );
      expect(warn).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ reason: 'no-policy-for-principal', hasUser: true }),
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain('org_1');
    } finally {
      warn.mockRestore();
    }
  });

  it.each([
    ['no user', undefined, 'missing-user-context', 'the request has no authenticated user.'],
    [
      'a user whose organization id is a number',
      { workosId: 'user_1', organizationId: 42 },
      'invalid-organization-id',
      "the authenticated user's organization id is not a string.",
    ],
    [
      'a signed-in session whose active organization id is not a string',
      { user: { id: 'user_1' }, session: { activeOrganizationId: { id: 'org_1' } } },
      'invalid-organization-id',
      "the authenticated user's organization id is not a string.",
    ],
    [
      'a valid user no credential policy covers',
      { id: 'user_1', organizationId: 'org_1' },
      'no-policy-for-principal',
      'no credential policy applies to this request.',
    ],
  ])(
    'tells the user and the host why a request with %s gets no credentials (#28697)',
    async (_case, user, reason, sentence) => {
      const logged = vi.fn();
      setCredentialLogger({ error: logged });
      try {
        setCredentialStoreProvider(
          () => fakeStore({}),
          async () => undefined,
        );
        const ctx = new RequestContext();
        if (user) ctx.set('user', user);

        const error = await prepareCredentialTenant(ctx).catch((thrown: unknown) => thrown);

        expect(error).toMatchObject({ message: `Tenant model credential policy could not be resolved: ${sentence}` });
        expect(credentialTenantFailureReason(error)).toBe(reason);
        expect(logged).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ reason }));
      } finally {
        setCredentialLogger(undefined);
      }
    },
  );

  it('ignores the removed principal precedence flag', () => {
    const ctx = new RequestContext();
    ctx.set('user', {
      workosId: 'user_1',
      organizationId: 'org_1',
      orgFirstCredentials: true,
    });
    expect(resolveTenantFromRequestContext(ctx)).toEqual({
      orgId: 'org_1',
      userId: 'user_1',
      credentialScope: 'user',
    });
  });

  it('uses user scope when controller state carries no Factory identity', () => {
    const ctx = new RequestContext();
    ctx.set('user', { workosId: 'user_1', organizationId: 'org_1' });
    ctx.set('controller', { state: { projectPath: '/tmp/x' } });
    expect(resolveTenantFromRequestContext(ctx)).toEqual({
      orgId: 'org_1',
      userId: 'user_1',
      credentialScope: 'user',
    });
  });

  it('ignores malformed user values', () => {
    const ctx = new RequestContext();
    ctx.set('user', 'not-a-user');
    expect(resolveTenantFromRequestContext(ctx)).toBeUndefined();
  });

  it('refuses a tenant whose resolved user id is not a string', () => {
    const ctx = new RequestContext();
    ctx.set('user', { session: { activeOrganizationId: 'org_1' }, user: { id: 7 } });
    expect(resolveTenantFromRequestContext(ctx)).toBeUndefined();
  });

  it('refuses a tenant whose resolved org id is not a string', () => {
    const ctx = new RequestContext();
    ctx.set('user', { session: { activeOrganizationId: 7 }, user: { id: 'prov_5' } });
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
