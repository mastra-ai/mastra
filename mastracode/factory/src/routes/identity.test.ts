import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type {
  FactoryIntegration,
  IntegrationCandidateAccount,
  IntegrationContext,
  IntegrationIdentityCapability,
} from '../integrations/base.js';
import { IdentityService } from '../services/identity-service.js';
import type { IdentityServiceIntegration } from '../services/identity-service.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { IdentityRoutes } from './identity.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

/**
 * Minimal fake integration: only the fields the identity capability
 * consults. The rest of the `FactoryIntegration` interface is untouched
 * by the routes, so building a real integration would be pure overhead.
 */
function fakeIntegration(id: string, identity?: IntegrationIdentityCapability): FactoryIntegration {
  return {
    id,
    routes: () => [],
    diagnostics: () => ({}),
    ...(identity ? { identity } : {}),
  };
}

/** A no-op IntegrationContext stand-in — the routes never touch it directly. */
function fakeContext(): IntegrationContext {
  return {} as IntegrationContext;
}

async function buildApp(options: {
  storage: Awaited<ReturnType<typeof createFactoryStorageForTests>>['integrationIdentity'];
  integrations?: IdentityServiceIntegration[];
  user?: { workosId: string; organizationId?: string };
}) {
  const service = new IdentityService({
    storage: options.storage,
    integrations: () => options.integrations ?? [],
  });
  const app = new Hono();
  app.use('*', async (context, next) => {
    if (options.user) context.set('factoryAuthUser' as never, options.user as never);
    await next();
  });
  mountApiRoutes(app as never, new IdentityRoutes({ auth: fakeRouteAuth(), service }).routes());
  return app;
}

const orgUser = { workosId: 'user-1', organizationId: 'org-1' };

describe('IdentityRoutes', () => {
  describe('tenant gates', () => {
    it('rejects an unsigned request with 401 on every verb', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({ storage: seed.integrationIdentity });
      expect((await app.request('/web/identity')).status).toBe(401);
      expect(
        (
          await app.request('/web/identity', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          })
        ).status,
      ).toBe(401);
      expect(
        (await app.request('/web/identity?integrationId=github&externalUserId=octocat', { method: 'DELETE' })).status,
      ).toBe(401);
    });

    it('rejects a signed-in user without an org with 403', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({ storage: seed.integrationIdentity, user: { workosId: 'user-1' } });
      expect((await app.request('/web/identity')).status).toBe(403);
    });
  });

  describe('GET /web/identity', () => {
    it('merges provider members across every identity-capable integration and tags each with its integration id and claim state', async () => {
      const seed = await createFactoryStorageForTests();
      // Acting user has already claimed `octocat` on github.
      await seed.integrationIdentity.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        integrationId: 'github',
        externalUserId: 'octocat',
        label: 'Octocat',
      });
      const githubList = vi.fn<IntegrationIdentityCapability['listCandidateAccounts']>().mockResolvedValue([
        { externalUserId: 'octocat', label: 'Octocat' },
        { externalUserId: 'monalisa', label: 'Monalisa' },
      ] satisfies IntegrationCandidateAccount[]);
      const linearList = vi
        .fn<IntegrationIdentityCapability['listCandidateAccounts']>()
        .mockResolvedValue([{ externalUserId: 'alice', label: 'Alice' }] satisfies IntegrationCandidateAccount[]);

      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [
          { integration: fakeIntegration('github', { listCandidateAccounts: githubList }), context: fakeContext() },
          { integration: fakeIntegration('opaque'), context: fakeContext() }, // no identity capability
          { integration: fakeIntegration('linear', { listCandidateAccounts: linearList }), context: fakeContext() },
        ],
        user: orgUser,
      });

      const response = await app.request('/web/identity');
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        integrations: Array<{ id: string }>;
        identities: Array<{ integrationId: string; externalUserId: string; claimed: boolean; label: string }>;
      };
      expect(body.integrations).toEqual([{ id: 'github' }, { id: 'linear' }]);
      expect(body.identities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ integrationId: 'github', externalUserId: 'octocat', claimed: true }),
          expect.objectContaining({ integrationId: 'github', externalUserId: 'monalisa', claimed: false }),
          expect.objectContaining({ integrationId: 'linear', externalUserId: 'alice', claimed: false }),
        ]),
      );
      expect(body.identities).toHaveLength(3);
    });

    it('forwards an optional query filter to every identity-capable integration', async () => {
      const seed = await createFactoryStorageForTests();
      const githubList = vi.fn<IntegrationIdentityCapability['listCandidateAccounts']>().mockResolvedValue([]);
      const linearList = vi.fn<IntegrationIdentityCapability['listCandidateAccounts']>().mockResolvedValue([]);
      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [
          { integration: fakeIntegration('github', { listCandidateAccounts: githubList }), context: fakeContext() },
          { integration: fakeIntegration('linear', { listCandidateAccounts: linearList }), context: fakeContext() },
        ],
        user: orgUser,
      });
      const response = await app.request('/web/identity?query=octo');
      expect(response.status).toBe(200);
      expect(githubList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ orgId: 'org-1', query: 'octo', signal: expect.any(AbortSignal) }),
      );
      expect(linearList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ orgId: 'org-1', query: 'octo', signal: expect.any(AbortSignal) }),
      );
    });

    it('rejects an over-long query with 400', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({ storage: seed.integrationIdentity, user: orgUser });
      const response = await app.request(`/web/identity?query=${'x'.repeat(300)}`);
      expect(response.status).toBe(400);
    });

    it('drops a failing integration and keeps the rest of the merged feed', async () => {
      const seed = await createFactoryStorageForTests();
      const brokenList = vi
        .fn<IntegrationIdentityCapability['listCandidateAccounts']>()
        .mockRejectedValue(new Error('boom'));
      const workingList = vi
        .fn<IntegrationIdentityCapability['listCandidateAccounts']>()
        .mockResolvedValue([{ externalUserId: 'alice', label: 'Alice' }]);
      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [
          { integration: fakeIntegration('github', { listCandidateAccounts: brokenList }), context: fakeContext() },
          { integration: fakeIntegration('linear', { listCandidateAccounts: workingList }), context: fakeContext() },
        ],
        user: orgUser,
      });
      const response = await app.request('/web/identity');
      expect(response.status).toBe(200);
      const body = (await response.json()) as { identities: Array<{ integrationId: string }> };
      expect(body.identities.map(row => row.integrationId)).toEqual(['linear']);
    });

    it('returns one row per (integrationId, externalUserId) even when a provider surfaces duplicates', async () => {
      const seed = await createFactoryStorageForTests();
      const githubList = vi.fn<IntegrationIdentityCapability['listCandidateAccounts']>().mockResolvedValue([
        // Same login discovered through two connected orgs.
        { externalUserId: 'octocat', label: 'octocat', installation: 'org-a' },
        { externalUserId: 'octocat', label: 'octocat', installation: 'org-b' },
      ]);
      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [
          { integration: fakeIntegration('github', { listCandidateAccounts: githubList }), context: fakeContext() },
        ],
        user: orgUser,
      });
      const response = await app.request('/web/identity');
      expect(response.status).toBe(200);
      const body = (await response.json()) as { identities: Array<{ externalUserId: string }> };
      expect(body.identities.map(row => row.externalUserId)).toEqual(['octocat']);
    });

    it('still surfaces claims the provider no longer lists so the user can unclaim them', async () => {
      const seed = await createFactoryStorageForTests();
      await seed.integrationIdentity.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        integrationId: 'github',
        externalUserId: 'ex-employee',
        label: 'Ex Employee',
      });
      const githubList = vi.fn<IntegrationIdentityCapability['listCandidateAccounts']>().mockResolvedValue([]); // provider no longer surfaces the ex-employee
      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [
          { integration: fakeIntegration('github', { listCandidateAccounts: githubList }), context: fakeContext() },
        ],
        user: orgUser,
      });
      const response = await app.request('/web/identity');
      expect(response.status).toBe(200);
      const body = (await response.json()) as { identities: Array<{ externalUserId: string; claimed: boolean }> };
      expect(body.identities).toEqual([expect.objectContaining({ externalUserId: 'ex-employee', claimed: true })]);
    });

    it('scopes identities by org — claims in another org do not leak', async () => {
      const seed = await createFactoryStorageForTests();
      await seed.integrationIdentity.upsert({
        orgId: 'org-2',
        userId: 'user-1',
        integrationId: 'github',
        externalUserId: 'not-me-here',
        label: 'X',
      });
      const githubList = vi
        .fn<IntegrationIdentityCapability['listCandidateAccounts']>()
        .mockResolvedValue([{ externalUserId: 'octocat', label: 'Octocat' }]);
      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [
          { integration: fakeIntegration('github', { listCandidateAccounts: githubList }), context: fakeContext() },
        ],
        user: orgUser,
      });
      const response = await app.request('/web/identity');
      expect(response.status).toBe(200);
      const body = (await response.json()) as { identities: Array<{ externalUserId: string; claimed: boolean }> };
      expect(body.identities).toEqual([expect.objectContaining({ externalUserId: 'octocat', claimed: false })]);
    });
  });

  describe('POST /web/identity', () => {
    const githubIdentity: IntegrationIdentityCapability = { listCandidateAccounts: async () => [] };
    const identityCapableIntegrations = () => [
      { integration: fakeIntegration('github', githubIdentity), context: fakeContext() },
    ];

    it('creates a fresh claim with 201', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({
        storage: seed.integrationIdentity,
        user: orgUser,
        integrations: identityCapableIntegrations(),
      });
      const response = await app.request('/web/identity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          integrationId: 'github',
          externalUserId: 'octocat',
          label: 'Octocat',
          email: 'octocat@example.com',
        }),
      });
      expect(response.status).toBe(201);
      const body = (await response.json()) as {
        claim: { externalUserId: string; label: string; email?: string };
      };
      expect(body.claim).toMatchObject({
        externalUserId: 'octocat',
        label: 'Octocat',
        email: 'octocat@example.com',
      });
      const listed = await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' });
      expect(listed).toHaveLength(1);
    });

    it('is idempotent — re-claiming the same key returns 200 and updates the display label', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({
        storage: seed.integrationIdentity,
        user: orgUser,
        integrations: identityCapableIntegrations(),
      });
      await app.request('/web/identity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ integrationId: 'github', externalUserId: 'octocat', label: 'Octocat' }),
      });
      const response = await app.request('/web/identity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ integrationId: 'github', externalUserId: 'octocat', label: 'Octo the Cat' }),
      });
      expect(response.status).toBe(200);
      const listed = await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' });
      expect(listed).toHaveLength(1);
      expect(listed[0]?.label).toBe('Octo the Cat');
    });

    it('rejects a body missing required fields with 400', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({
        storage: seed.integrationIdentity,
        user: orgUser,
        integrations: identityCapableIntegrations(),
      });
      const response = await app.request('/web/identity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ integrationId: 'github', externalUserId: 'octocat' }),
      });
      expect(response.status).toBe(400);
    });

    it('rejects an entirely non-JSON body with 400', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({
        storage: seed.integrationIdentity,
        user: orgUser,
        integrations: identityCapableIntegrations(),
      });
      const response = await app.request('/web/identity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      });
      expect(response.status).toBe(400);
    });

    it('rejects a claim against an integration that does not advertise the identity capability', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({
        storage: seed.integrationIdentity,
        user: orgUser,
        integrations: identityCapableIntegrations(),
      });
      const response = await app.request('/web/identity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          integrationId: 'not-a-real-integration',
          externalUserId: 'octocat',
          label: 'Octocat',
        }),
      });
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('unknown_integration');
      const listed = await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' });
      expect(listed).toHaveLength(0);
    });
  });

  describe('DELETE /web/identity', () => {
    it('deletes an existing claim (204) and is idempotent on repeat (also 204)', async () => {
      const seed = await createFactoryStorageForTests();
      await seed.integrationIdentity.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        integrationId: 'github',
        externalUserId: 'octocat',
        label: 'Octocat',
      });
      const app = await buildApp({ storage: seed.integrationIdentity, user: orgUser });

      const first = await app.request('/web/identity?integrationId=github&externalUserId=octocat', {
        method: 'DELETE',
      });
      expect(first.status).toBe(204);
      expect(await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' })).toHaveLength(0);

      const second = await app.request('/web/identity?integrationId=github&externalUserId=octocat', {
        method: 'DELETE',
      });
      expect(second.status).toBe(204);
    });

    it("does not touch another user's claim on the same key", async () => {
      const seed = await createFactoryStorageForTests();
      await seed.integrationIdentity.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        integrationId: 'github',
        externalUserId: 'octocat',
        label: 'Mine',
      });
      await seed.integrationIdentity.upsert({
        orgId: 'org-1',
        userId: 'user-2',
        integrationId: 'github',
        externalUserId: 'octocat',
        label: 'Theirs',
      });
      const app = await buildApp({ storage: seed.integrationIdentity, user: orgUser });

      await app.request('/web/identity?integrationId=github&externalUserId=octocat', { method: 'DELETE' });
      const stillClaimed = await seed.integrationIdentity.listByExternalUser({
        orgId: 'org-1',
        integrationId: 'github',
        externalUserId: 'octocat',
      });
      expect(stillClaimed).toHaveLength(1);
      expect(stillClaimed[0]?.userId).toBe('user-2');
    });

    it('rejects missing query params with 400', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({ storage: seed.integrationIdentity, user: orgUser });
      const response = await app.request('/web/identity', { method: 'DELETE' });
      expect(response.status).toBe(400);
    });
  });
});
