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
    it('rejects an unsigned request with 401', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({ storage: seed.integrationIdentity });
      expect((await app.request('/web/identity/claims')).status).toBe(401);
      expect((await app.request('/web/identity/integrations')).status).toBe(401);
      expect((await app.request('/web/identity/candidates/github')).status).toBe(401);
    });

    it('rejects a signed-in user without an org with 403', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({ storage: seed.integrationIdentity, user: { workosId: 'user-1' } });
      expect((await app.request('/web/identity/claims')).status).toBe(403);
    });
  });

  describe('GET /web/identity/integrations', () => {
    it('lists integrations that opted into the capability, skips those that did not', async () => {
      const seed = await createFactoryStorageForTests();
      const identity: IntegrationIdentityCapability = { listCandidateAccounts: async () => [] };
      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [
          { integration: fakeIntegration('github', identity), context: fakeContext() },
          { integration: fakeIntegration('opaque'), context: fakeContext() }, // no identity
          { integration: fakeIntegration('linear', identity), context: fakeContext() },
        ],
        user: orgUser,
      });
      const response = await app.request('/web/identity/integrations');
      expect(response.status).toBe(200);
      expect((await response.json()) as unknown).toEqual({
        integrations: [{ id: 'github' }, { id: 'linear' }],
      });
    });
  });

  describe('GET /web/identity/candidates/:integrationId', () => {
    it('proxies to the capability and forwards optional query text', async () => {
      const seed = await createFactoryStorageForTests();
      const listCandidateAccounts = vi
        .fn<IntegrationIdentityCapability['listCandidateAccounts']>()
        .mockResolvedValue([
          { externalUserId: 'octocat', label: 'Octocat', sources: ['observed'] },
        ] satisfies IntegrationCandidateAccount[]);
      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [{ integration: fakeIntegration('github', { listCandidateAccounts }), context: fakeContext() }],
        user: orgUser,
      });

      const response = await app.request('/web/identity/candidates/github?query=octo');
      expect(response.status).toBe(200);
      expect((await response.json()) as unknown).toEqual({
        candidates: [{ externalUserId: 'octocat', label: 'Octocat', sources: ['observed'] }],
      });
      expect(listCandidateAccounts).toHaveBeenCalledWith(expect.anything(), { orgId: 'org-1', query: 'octo' });
    });

    it('omits query when the request does not send one', async () => {
      const seed = await createFactoryStorageForTests();
      const listCandidateAccounts = vi
        .fn<IntegrationIdentityCapability['listCandidateAccounts']>()
        .mockResolvedValue([]);
      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [{ integration: fakeIntegration('github', { listCandidateAccounts }), context: fakeContext() }],
        user: orgUser,
      });
      await app.request('/web/identity/candidates/github');
      expect(listCandidateAccounts).toHaveBeenCalledWith(expect.anything(), { orgId: 'org-1' });
    });

    it('returns an empty list for an unknown integration id (no 404)', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({ storage: seed.integrationIdentity, user: orgUser });
      const response = await app.request('/web/identity/candidates/never-registered');
      expect(response.status).toBe(200);
      expect((await response.json()) as unknown).toEqual({ candidates: [] });
    });

    it('rejects an over-long query with 400', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({ storage: seed.integrationIdentity, user: orgUser });
      const response = await app.request(`/web/identity/candidates/github?query=${'x'.repeat(300)}`);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /web/identity/candidates (merged)', () => {
    it('merges candidates from every identity-capable integration and tags each with its integration id', async () => {
      const seed = await createFactoryStorageForTests();
      const githubList = vi
        .fn<IntegrationIdentityCapability['listCandidateAccounts']>()
        .mockResolvedValue([
          { externalUserId: 'octocat', label: 'Octocat', sources: ['observed'] },
        ] satisfies IntegrationCandidateAccount[]);
      const linearList = vi
        .fn<IntegrationIdentityCapability['listCandidateAccounts']>()
        .mockResolvedValue([
          { externalUserId: 'alice', label: 'Alice', sources: ['observed'] },
        ] satisfies IntegrationCandidateAccount[]);
      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [
          { integration: fakeIntegration('github', { listCandidateAccounts: githubList }), context: fakeContext() },
          { integration: fakeIntegration('linear', { listCandidateAccounts: linearList }), context: fakeContext() },
        ],
        user: orgUser,
      });

      const response = await app.request('/web/identity/candidates?query=a');
      expect(response.status).toBe(200);
      const body = (await response.json()) as { candidates: Array<{ integrationId: string; externalUserId: string }> };
      expect(body.candidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ integrationId: 'github', externalUserId: 'octocat' }),
          expect.objectContaining({ integrationId: 'linear', externalUserId: 'alice' }),
        ]),
      );
      expect(githubList).toHaveBeenCalledWith(expect.anything(), { orgId: 'org-1', query: 'a' });
      expect(linearList).toHaveBeenCalledWith(expect.anything(), { orgId: 'org-1', query: 'a' });
    });

    it('drops a failing integration and keeps the rest of the merged feed', async () => {
      const seed = await createFactoryStorageForTests();
      const brokenList = vi
        .fn<IntegrationIdentityCapability['listCandidateAccounts']>()
        .mockRejectedValue(new Error('boom'));
      const workingList = vi
        .fn<IntegrationIdentityCapability['listCandidateAccounts']>()
        .mockResolvedValue([{ externalUserId: 'alice', label: 'Alice', sources: ['observed'] }]);
      const app = await buildApp({
        storage: seed.integrationIdentity,
        integrations: [
          { integration: fakeIntegration('github', { listCandidateAccounts: brokenList }), context: fakeContext() },
          { integration: fakeIntegration('linear', { listCandidateAccounts: workingList }), context: fakeContext() },
        ],
        user: orgUser,
      });
      const response = await app.request('/web/identity/candidates');
      expect(response.status).toBe(200);
      const body = (await response.json()) as { candidates: Array<{ integrationId: string }> };
      expect(body.candidates.map(candidate => candidate.integrationId)).toEqual(['linear']);
    });
  });

  describe('POST /web/identity/claims', () => {
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
      const response = await app.request('/web/identity/claims', {
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
      const body = (await response.json()) as { claim: { externalUserId: string; label: string; email?: string } };
      expect(body.claim).toMatchObject({
        externalUserId: 'octocat',
        label: 'Octocat',
        email: 'octocat@example.com',
      });
    });

    it('replays a claim with 200 (idempotent)', async () => {
      const seed = await createFactoryStorageForTests();
      const app = await buildApp({
        storage: seed.integrationIdentity,
        user: orgUser,
        integrations: identityCapableIntegrations(),
      });
      const body = {
        integrationId: 'github',
        externalUserId: 'octocat',
        label: 'Octocat',
      };
      const first = await app.request('/web/identity/claims', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(first.status).toBe(201);
      const second = await app.request('/web/identity/claims', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, label: 'Octo the Cat' }),
      });
      expect(second.status).toBe(200);
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
      const response = await app.request('/web/identity/claims', {
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
      const response = await app.request('/web/identity/claims', {
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
      const response = await app.request('/web/identity/claims', {
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

  describe('GET /web/identity/claims', () => {
    it('lists the acting user claims across every integration, scoped to org', async () => {
      const seed = await createFactoryStorageForTests();
      // My claims in org-1.
      await seed.integrationIdentity.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        integrationId: 'github',
        externalUserId: 'octocat',
        label: 'Octocat',
      });
      await seed.integrationIdentity.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        integrationId: 'linear',
        externalUserId: 'user-lin',
        label: 'Ada',
      });
      // Same user, different org — must not leak.
      await seed.integrationIdentity.upsert({
        orgId: 'org-2',
        userId: 'user-1',
        integrationId: 'github',
        externalUserId: 'someone-else',
        label: 'X',
      });
      // Same org, different user — must not leak.
      await seed.integrationIdentity.upsert({
        orgId: 'org-1',
        userId: 'user-2',
        integrationId: 'github',
        externalUserId: 'someone-else',
        label: 'Y',
      });
      const app = await buildApp({ storage: seed.integrationIdentity, user: orgUser });
      const response = await app.request('/web/identity/claims');
      expect(response.status).toBe(200);
      const body = (await response.json()) as { claims: Array<{ integrationId: string; externalUserId: string }> };
      expect(body.claims).toHaveLength(2);
      expect(body.claims.map(c => `${c.integrationId}:${c.externalUserId}`).sort()).toEqual([
        'github:octocat',
        'linear:user-lin',
      ]);
    });
  });

  describe('DELETE /web/identity/claims/:integrationId/:externalUserId', () => {
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

      const first = await app.request('/web/identity/claims/github/octocat', { method: 'DELETE' });
      expect(first.status).toBe(204);
      expect(await seed.integrationIdentity.listByUser({ orgId: 'org-1', userId: 'user-1' })).toHaveLength(0);

      const second = await app.request('/web/identity/claims/github/octocat', { method: 'DELETE' });
      expect(second.status).toBe(204);
    });

    it('does not touch another users claim on the same key', async () => {
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

      await app.request('/web/identity/claims/github/octocat', { method: 'DELETE' });
      const stillClaimed = await seed.integrationIdentity.listByExternalUser({
        orgId: 'org-1',
        integrationId: 'github',
        externalUserId: 'octocat',
      });
      expect(stillClaimed).toHaveLength(1);
      expect(stillClaimed[0]?.userId).toBe('user-2');
    });
  });
});
