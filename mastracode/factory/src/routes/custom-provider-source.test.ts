import { resolveCustomProviders } from '@mastra/code-sdk/agents/custom-provider-source';
import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import {
  createCustomProvidersPrimer,
  invalidateCustomProvidersSnapshots,
  registerCustomProvidersSource,
  resetCustomProvidersSourceForTests,
} from './custom-provider-source.js';
import { fakeRouteAuth } from './test-utils.js';

let seed: FactoryStorageTestSeed;

const ORG = 'org1';
const USER = 'user-a';

const ACME = {
  providerId: 'acme',
  name: 'Acme',
  url: 'https://llm.acme.dev/v1',
  apiKey: 'sk-acme',
  models: ['fast-1'],
};

function tenantContext(user: { workosId: string; organizationId?: string }): RequestContext {
  const ctx = new RequestContext();
  ctx.set('user', user);
  return ctx;
}

function buildApp(user: { workosId: string; organizationId?: string } | null, authEnabled: boolean) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  app.use('*', createCustomProvidersPrimer({ auth: fakeRouteAuth(), storage: seed.customProviders, authEnabled }));
  app.get('/ok', c => c.text('ok'));
  return app;
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
});

afterEach(() => {
  resetCustomProvidersSourceForTests();
});

describe('registerCustomProvidersSource (tenant mode)', () => {
  it('serves the caller org rows once primed', async () => {
    await seed.customProviders.upsert({ orgId: ORG, userId: USER, input: ACME });
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: true });

    await buildApp({ workosId: USER, organizationId: ORG }, true).request('/ok');

    expect(resolveCustomProviders(tenantContext({ workosId: USER, organizationId: ORG }))).toEqual([
      { name: 'Acme', url: 'https://llm.acme.dev/v1', apiKey: 'sk-acme', models: ['fast-1'] },
    ]);
  });

  it('isolates orgs: another org never sees the rows', async () => {
    await seed.customProviders.upsert({ orgId: ORG, userId: USER, input: ACME });
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: true });

    await buildApp({ workosId: 'user-b', organizationId: 'org2' }, true).request('/ok');

    expect(resolveCustomProviders(tenantContext({ workosId: 'user-b', organizationId: 'org2' }))).toEqual([]);
  });

  it('fails closed without an authenticated tenant', async () => {
    await seed.customProviders.upsert({ orgId: ORG, userId: USER, input: ACME });
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: true });

    // Boot-time catalog and unauthenticated calls resolve no tenant.
    expect(resolveCustomProviders()).toEqual([]);
  });

  it('invalidation makes a write visible on the next prime, before the TTL', async () => {
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: true });
    const app = buildApp({ workosId: USER, organizationId: ORG }, true);
    const ctx = tenantContext({ workosId: USER, organizationId: ORG });

    await app.request('/ok');
    expect(resolveCustomProviders(ctx)).toEqual([]);

    await seed.customProviders.upsert({ orgId: ORG, userId: USER, input: ACME });
    invalidateCustomProvidersSnapshots({ orgId: ORG });
    await app.request('/ok');

    expect(resolveCustomProviders(ctx)).toHaveLength(1);
  });
});

describe('registerCustomProvidersSource (no-auth mode)', () => {
  it('serves the sentinel local org rows, tenant or not', async () => {
    await seed.customProviders.upsert({ orgId: 'local', userId: 'local', input: ACME });
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: false });

    await buildApp(null, false).request('/ok');

    expect(resolveCustomProviders()).toEqual([
      { name: 'Acme', url: 'https://llm.acme.dev/v1', apiKey: 'sk-acme', models: ['fast-1'] },
    ]);
  });
});

describe('resetCustomProvidersSourceForTests', () => {
  it('clears registration so the SDK falls back to settings', () => {
    registerCustomProvidersSource({ storage: seed.customProviders, authEnabled: false });
    resetCustomProvidersSourceForTests();
    expect(resolveCustomProviders()).toBeUndefined();
  });
});
