import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { FACTORY_DOC_KINDS } from '../storage/domains/documents/catalog.js';
import type { FactoryDocumentsRefresher } from '../storage/domains/documents/refresh.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { DocumentRoutes } from './documents.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const ORG = 'org-1';

async function createHarness(
  options: { refresh?: FactoryDocumentsRefresher; user?: { workosId: string; organizationId?: string } } = {},
) {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: ORG, userId: 'user-1', input: { name: 'Docs project' } });
  const routes = new DocumentRoutes({
    auth: fakeRouteAuth(),
    projects: seed.projects,
    documents: seed.documents,
    ...(options.refresh ? { refresh: options.refresh } : {}),
  }).routes();
  const app = new Hono();
  const user = options.user ?? { workosId: 'user-1', organizationId: ORG };
  app.use('*', async (context, next) => {
    context.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as never, routes);
  return { app, seed, projectId: project.id };
}

async function seedSnapshot(seed: Awaited<ReturnType<typeof createFactoryStorageForTests>>, projectId: string) {
  await seed.documents.replaceSnapshot({
    orgId: ORG,
    factoryProjectId: projectId,
    sourceRef: 'origin/main',
    sourceSha: 'abc123',
    manifestStatus: 'ok',
    syncedAt: new Date('2026-09-01T00:00:00.000Z'),
    documents: FACTORY_DOC_KINDS.map(definition =>
      definition.kind === 'architecture'
        ? {
            kind: definition.kind,
            path: definition.defaultPath,
            status: 'present' as const,
            title: 'System Architecture',
            summary: 'Two services.',
            content: '# System Architecture\n\nTwo services.',
            contentHash: 'h',
            sizeBytes: 40,
          }
        : { kind: definition.kind, path: definition.defaultPath, status: 'missing' as const },
    ),
  });
}

describe('DocumentRoutes', () => {
  it('lists the catalog, the synced entries without bodies, and the sync state', async () => {
    const { app, seed, projectId } = await createHarness();
    await seedSnapshot(seed, projectId);

    const response = await app.request(`/web/factory/projects/${projectId}/documents`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.docsRoot).toBe('docs/factory');
    expect(body.manifestPath).toBe('docs/factory/manifest.yaml');
    expect(body.catalog).toHaveLength(FACTORY_DOC_KINDS.length);
    expect(body.catalog[0]).toMatchObject({ kind: 'product-vision', group: 'ba', label: 'Product vision / PRD' });
    expect(body.documents).toHaveLength(FACTORY_DOC_KINDS.length);
    const architecture = body.documents.find((entry: { kind: string }) => entry.kind === 'architecture');
    expect(architecture).toMatchObject({
      status: 'present',
      title: 'System Architecture',
      syncedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(architecture).not.toHaveProperty('content');
    expect(body.sync).toEqual({
      sourceRef: 'origin/main',
      sourceSha: 'abc123',
      manifestStatus: 'ok',
      syncedAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('returns an empty inventory with a null sync before the first sync', async () => {
    const { app, projectId } = await createHarness();
    const body = await (await app.request(`/web/factory/projects/${projectId}/documents`)).json();
    expect(body.documents).toEqual([]);
    expect(body.sync).toBeNull();
    expect(body.catalog).toHaveLength(FACTORY_DOC_KINDS.length);
  });

  it('serves one document with its body and 404s unknown kinds or unsynced projects', async () => {
    const { app, seed, projectId } = await createHarness();
    expect((await app.request(`/web/factory/projects/${projectId}/documents/architecture`)).status).toBe(404);
    await seedSnapshot(seed, projectId);

    const response = await app.request(`/web/factory/projects/${projectId}/documents/architecture`);
    expect(response.status).toBe(200);
    expect((await response.json()).document).toMatchObject({
      kind: 'architecture',
      content: '# System Architecture\n\nTwo services.',
    });
    expect((await app.request(`/web/factory/projects/${projectId}/documents/roadmap`)).status).toBe(404);
    // A missing document still resolves — the page shows the expected path.
    const missing = await (await app.request(`/web/factory/projects/${projectId}/documents/glossary`)).json();
    expect(missing.document).toMatchObject({ status: 'missing', content: null });
  });

  it('fails closed on auth and cross-org projects', async () => {
    const { app, projectId } = await createHarness({ user: { workosId: 'user-2', organizationId: 'org-2' } });
    expect((await app.request(`/web/factory/projects/${projectId}/documents`)).status).toBe(404);

    const noOrg = await createHarness({ user: { workosId: 'user-3' } });
    expect((await noOrg.app.request(`/web/factory/projects/${noOrg.projectId}/documents`)).status).toBe(403);
    expect((await noOrg.app.request(`/web/factory/projects/not-a-uuid/documents`)).status).toBe(403);
  });

  it('refreshes through the injected refresher and maps its outcomes', async () => {
    const refresh = vi.fn<FactoryDocumentsRefresher>();
    const { app, seed, projectId } = await createHarness({ refresh });
    const url = `/web/factory/projects/${projectId}/documents/refresh`;

    refresh.mockResolvedValueOnce({ outcome: 'no_active_sandbox' });
    const conflict = await app.request(url, { method: 'POST' });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toBe('no_active_sandbox');
    expect(refresh).toHaveBeenCalledWith({ orgId: ORG, factoryProjectId: projectId });

    refresh.mockResolvedValueOnce({ outcome: 'no_repository' });
    expect((await (await app.request(url, { method: 'POST' })).json()).error).toBe('no_repository');

    refresh.mockResolvedValueOnce({ outcome: 'ref_unavailable', reason: 'fatal: bad ref' });
    expect((await (await app.request(url, { method: 'POST' })).json()).message).toMatch(/bad ref/);

    await seedSnapshot(seed, projectId);
    refresh.mockResolvedValueOnce({ outcome: 'synced', sourceRef: 'origin/main', sourceSha: 'abc123' });
    const ok = await app.request(url, { method: 'POST' });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({
      ok: true,
      outcome: 'synced',
      sync: {
        sourceRef: 'origin/main',
        sourceSha: 'abc123',
        manifestStatus: 'ok',
        syncedAt: '2026-09-01T00:00:00.000Z',
      },
    });
  });

  it('answers 503 for refresh when no sandbox is configured', async () => {
    const { app, projectId } = await createHarness();
    const response = await app.request(`/web/factory/projects/${projectId}/documents/refresh`, { method: 'POST' });
    expect(response.status).toBe(503);
  });
});
