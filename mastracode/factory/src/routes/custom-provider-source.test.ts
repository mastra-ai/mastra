import { prepareCredentialTenant, setCredentialStoreProvider } from '@mastra/code-sdk/agents/credential-resolver';
import type { CredentialScope } from '@mastra/code-sdk/agents/credential-resolver';
import { resolveCustomProviders } from '@mastra/code-sdk/agents/custom-provider-source';
import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { ConfigRoutes } from './config.js';
import {
  createCustomProvidersPrimer,
  invalidateCustomProvidersSnapshots,
  primeCustomProvidersForRequestContext,
  registerCustomProvidersSource,
  resetCustomProvidersSourceForTests,
} from './custom-provider-source.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

let seed: FactoryStorageTestSeed;

const ORG = 'org1';
const USER = 'user-a';
const OTHER_USER = 'user-b';

const ACME = {
  providerId: 'acme',
  name: 'Acme',
  url: 'https://llm.acme.dev/v1',
  apiKey: 'sk-acme',
  models: ['fast-1'],
};
const ACME_PROVIDER = { name: 'Acme', url: 'https://llm.acme.dev/v1', apiKey: 'sk-acme', models: ['fast-1'] };

type WebUser = { workosId: string; organizationId?: string };

/** A signed-in request with no Factory policy: personal work, as the account itself. */
function tenantContext(user: WebUser): RequestContext {
  const ctx = new RequestContext();
  ctx.set('user', user);
  return ctx;
}

/**
 * A run whose trusted model policy the Factory resolved: the account it runs
 * as, and the credential scope its Factory uses. Goes through the same SDK
 * seam the Factory registers its policy resolver on.
 */
async function policyContext(user: WebUser, credentialScope: CredentialScope): Promise<RequestContext> {
  setCredentialStoreProvider(
    () => undefined,
    async () => ({ orgId: user.organizationId, userId: user.workosId, credentialScope }),
  );
  const ctx = tenantContext(user);
  await prepareCredentialTenant(ctx);
  return ctx;
}

function buildApp(user: WebUser | null, authEnabled: boolean) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  app.use('*', createCustomProvidersPrimer({ auth: fakeRouteAuth(), storage: seed.customProviders, authEnabled }));
  app.get('/ok', c => c.text('ok'));
  return app;
}

function endpoint(name: string) {
  return { providerId: name.toLowerCase(), name, url: `https://${name.toLowerCase()}.dev/v1`, models: ['m'] };
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
});

afterEach(() => {
  resetCustomProvidersSourceForTests();
  setCredentialStoreProvider(undefined);
});

describe('registerCustomProvidersSource (tenant mode)', () => {
  const member = { workosId: USER, organizationId: ORG };

  beforeEach(async () => {
    await seed.customProviders.upsert({ owner: { orgId: ORG }, createdBy: 'admin', input: endpoint('Shared') });
    await seed.customProviders.upsert({
      owner: { orgId: ORG, userId: USER },
      createdBy: USER,
      input: endpoint('Mine'),
    });
    await seed.customProviders.upsert({
      owner: { orgId: ORG, userId: OTHER_USER },
      createdBy: OTHER_USER,
      input: endpoint('Theirs'),
    });
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: true });
  });

  it("uses the organization's providers for Factory-scoped work", async () => {
    await buildApp(member, true).request('/ok');

    const providers = resolveCustomProviders(await policyContext(member, 'factory'));

    expect(providers?.map(provider => provider.name)).toEqual(['Shared']);
  });

  it("uses a member's own providers for personal work", async () => {
    await buildApp(member, true).request('/ok');

    expect(resolveCustomProviders(tenantContext(member))?.map(provider => provider.name)).toEqual(['Mine']);
    expect(resolveCustomProviders(await policyContext(member, 'user'))?.map(provider => provider.name)).toEqual([
      'Mine',
    ]);
  });

  // A session runs as its owner, whoever sends the message that wakes it.
  it("uses the session owner's providers when another member's request loaded them", async () => {
    await buildApp({ workosId: OTHER_USER, organizationId: ORG }, true).request('/ok');

    const providers = resolveCustomProviders(await policyContext(member, 'user'));

    expect(providers?.map(provider => provider.name)).toEqual(['Mine']);
  });

  it('isolates orgs: another org never sees the rows', async () => {
    const outsider = { workosId: USER, organizationId: 'org2' };
    await buildApp(outsider, true).request('/ok');

    expect(resolveCustomProviders(tenantContext(outsider))).toEqual([]);
    expect(resolveCustomProviders(await policyContext(outsider, 'factory'))).toEqual([]);
  });

  it('fails closed without an authenticated tenant', async () => {
    // Boot-time catalog and unauthenticated calls resolve no tenant.
    expect(resolveCustomProviders()).toEqual([]);
  });

  it('invalidation makes a write visible on the next prime, before the TTL', async () => {
    const app = buildApp(member, true);
    const ctx = tenantContext(member);

    await app.request('/ok');
    expect(resolveCustomProviders(ctx)).toHaveLength(1);

    await seed.customProviders.upsert({ owner: { orgId: ORG, userId: USER }, createdBy: USER, input: ACME });
    invalidateCustomProvidersSnapshots({ orgId: ORG });
    await app.request('/ok');

    expect(resolveCustomProviders(ctx)).toHaveLength(2);
  });
});

describe('custom providers saved in Settings', () => {
  // The routes and model resolution pick the list through the same rule, so an
  // endpoint saved from a Settings card is the one that card's work runs on.
  it('are used by the work their scope covers, and by nothing else', async () => {
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: true });
    const admin = { workosId: 'admin', organizationId: ORG };
    const member = { workosId: USER, organizationId: ORG };
    const auth = fakeRouteAuth({ isOrganizationAdmin: async (_organizationId, userId) => userId === 'admin' });
    const save = (user: WebUser, body: Record<string, unknown>) => {
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('factoryAuthUser' as never, user as never);
        await next();
      });
      mountApiRoutes(
        app as never,
        new ConfigRoutes({
          auth,
          controller: { listAvailableModels: async () => [] },
          customProviders: seed.customProviders,
          onCustomProvidersChanged: invalidateCustomProvidersSnapshots,
        }).routes(),
      );
      return app.request('/web/config/custom-providers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    };
    const names = (ctx: RequestContext) => resolveCustomProviders(ctx)?.map(provider => provider.name);

    expect((await save(admin, { ...endpoint('Shared'), scope: 'org' })).status).toBe(200);
    expect((await save(member, endpoint('Mine'))).status).toBe(200);
    await buildApp(member, true).request('/ok');

    expect(names(tenantContext(member))).toEqual(['Mine']);
    expect(names(await policyContext(member, 'factory'))).toEqual(['Shared']);
    expect(names(await policyContext(admin, 'user'))).toEqual([]);
  });
});

describe('registerCustomProvidersSource (account without an organization)', () => {
  // These accounts are keyed by a synthetic `user:<id>` org nobody else can
  // be in, so they keep the single list they had before personal providers.
  it('uses the same list for personal and Factory-scoped work', async () => {
    const solo = { workosId: 'solo' };
    await seed.customProviders.upsert({ owner: { orgId: 'user:solo' }, createdBy: 'solo', input: ACME });
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: true });

    await buildApp(solo, true).request('/ok');

    expect(resolveCustomProviders(tenantContext(solo))).toEqual([ACME_PROVIDER]);
    expect(resolveCustomProviders(await policyContext(solo, 'factory'))).toEqual([ACME_PROVIDER]);
    // Policy contexts carry the synthetic org id explicitly; same list.
    const explicit = { workosId: 'solo', organizationId: 'user:solo' };
    expect(resolveCustomProviders(await policyContext(explicit, 'user'))).toEqual([ACME_PROVIDER]);
  });
});

describe('primeCustomProvidersForRequestContext', () => {
  it('primes the run owner org for a wake with no inbound request', async () => {
    await seed.customProviders.upsert({ owner: { orgId: ORG, userId: USER }, createdBy: USER, input: ACME });
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: true });
    const ctx = tenantContext({ workosId: USER, organizationId: ORG });

    await primeCustomProvidersForRequestContext(ctx);

    expect(resolveCustomProviders(ctx)).toEqual([ACME_PROVIDER]);
  });

  it('primes nothing without a run owner', async () => {
    await seed.customProviders.upsert({ owner: { orgId: ORG, userId: USER }, createdBy: USER, input: ACME });
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: true });

    await primeCustomProvidersForRequestContext(new RequestContext());

    expect(resolveCustomProviders(tenantContext({ workosId: USER, organizationId: ORG }))).toEqual([]);
  });
});

describe('registerCustomProvidersSource (no-auth mode)', () => {
  it('serves the sentinel local org rows, tenant or not', async () => {
    await seed.customProviders.upsert({ owner: { orgId: 'local' }, createdBy: 'local', input: ACME });
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: false });

    await buildApp(null, false).request('/ok');

    expect(resolveCustomProviders()).toEqual([ACME_PROVIDER]);
  });
});

describe('resetCustomProvidersSourceForTests', () => {
  it('clears registration so the SDK falls back to settings', () => {
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: false });
    resetCustomProvidersSourceForTests();
    expect(resolveCustomProviders()).toBeUndefined();
  });
});
