import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalFilesystem } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryFsFile, FactoryFsListing } from './factory-fs.js';
import { FactoryFsRoutes } from './factory-fs.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const ORG_ID = 'org-1';

describe('FactoryFsRoutes', () => {
  let durableRoot: string;
  let durable: LocalFilesystem;

  beforeEach(() => {
    durableRoot = mkdtempSync(join(tmpdir(), 'factory-fs-routes-'));
    durable = new LocalFilesystem({ basePath: durableRoot });
  });

  afterEach(() => {
    rmSync(durableRoot, { recursive: true, force: true });
  });

  async function buildApp(options: {
    filesystem?: LocalFilesystem;
    user?: { workosId: string; organizationId?: string };
  }) {
    const seed = await createFactoryStorageForTests();
    const app = new Hono();
    app.use('*', async (context, next) => {
      if (options.user) context.set('factoryAuthUser' as never, options.user as never);
      await next();
    });
    mountApiRoutes(
      app as never,
      new FactoryFsRoutes({ auth: fakeRouteAuth(), filesystem: options.filesystem, projects: seed.projects }).routes(),
    );
    return { app, seed };
  }

  const asUser = { workosId: 'user-1', organizationId: ORG_ID };

  it('requires a signed-in user with an organization', async () => {
    const { app } = await buildApp({ filesystem: durable });
    expect((await app.request('/web/factory/fs/list')).status).toBe(401);

    const { app: orgless } = await buildApp({ filesystem: durable, user: { workosId: 'user-1' } });
    expect((await orgless.request('/web/factory/fs/list')).status).toBe(403);
    expect((await orgless.request('/web/factory/fs/file?path=shared/x.md')).status).toBe(403);
  });

  it('answers available:false when no durable filesystem is configured', async () => {
    const { app } = await buildApp({ user: asUser });
    const listing = (await (await app.request('/web/factory/fs/list')).json()) as FactoryFsListing;
    expect(listing).toEqual({ available: false, entries: [] });
    expect((await app.request('/web/factory/fs/file?path=shared/x.md')).status).toBe(404);
  });

  it('lists the org tree and reads files back', async () => {
    await durable.writeFile(`orgs/${ORG_ID}/shared/note.md`, 'org note', { recursive: true });
    await durable.writeFile(`orgs/${ORG_ID}/projects/Alpha/plans/issue-1.md`, '# plan', { recursive: true });
    const { app } = await buildApp({ filesystem: durable, user: asUser });

    const listing = (await (await app.request('/web/factory/fs/list')).json()) as FactoryFsListing;
    expect(listing.available).toBe(true);
    const paths = listing.entries.map(entry => entry.path).sort();
    expect(paths).toEqual([
      'projects',
      'projects/Alpha',
      'projects/Alpha/plans',
      'projects/Alpha/plans/issue-1.md',
      'shared',
      'shared/note.md',
    ]);
    const note = listing.entries.find(entry => entry.path === 'shared/note.md')!;
    expect(note.type).toBe('file');
    expect(note.size).toBeGreaterThan(0);
    expect(note.updatedAt).not.toBe('');

    const file = (await (
      await app.request('/web/factory/fs/file?path=projects/Alpha/plans/issue-1.md')
    ).json()) as FactoryFsFile;
    expect(file).toMatchObject({
      path: 'projects/Alpha/plans/issue-1.md',
      name: 'issue-1.md',
      contentType: 'text',
      content: '# plan',
    });
  });

  it('resolves projectDir for the requesting project', async () => {
    const { app, seed } = await buildApp({ filesystem: durable, user: asUser });
    const project = await seed.projects.create({ orgId: ORG_ID, userId: 'user-1', input: { name: 'Alpha Project' } });

    const listing = (await (
      await app.request(`/web/factory/fs/list?projectId=${project.id}`)
    ).json()) as FactoryFsListing;
    expect(listing.projectDir).toBe('projects/Alpha Project');

    // Unknown project id → listing still works, no projectDir.
    const fallback = (await (
      await app.request('/web/factory/fs/list?projectId=00000000-0000-4000-8000-000000000000')
    ).json()) as FactoryFsListing;
    expect(fallback.projectDir).toBeUndefined();
  });

  it('scopes everything to the caller org', async () => {
    await durable.writeFile('orgs/org-2/shared/secret.md', 'other org', { recursive: true });
    const { app } = await buildApp({ filesystem: durable, user: asUser });

    const listing = (await (await app.request('/web/factory/fs/list')).json()) as FactoryFsListing;
    expect(listing.entries).toEqual([]);
    expect((await app.request('/web/factory/fs/file?path=../org-2/shared/secret.md')).status).toBe(400);
    expect(
      (await app.request(`/web/factory/fs/file?path=${encodeURIComponent('..\\org-2\\shared\\secret.md')}`)).status,
    ).toBe(400);
    expect(
      (await app.request(`/web/factory/fs/file?path=${encodeURIComponent('/orgs/org-2/shared/secret.md')}`)).status,
    ).toBe(400);
  });

  it('rejects missing paths and answers 404 for absent files', async () => {
    const { app } = await buildApp({ filesystem: durable, user: asUser });
    expect((await app.request('/web/factory/fs/file')).status).toBe(400);
    expect((await app.request('/web/factory/fs/file?path=shared/missing.md')).status).toBe(404);
  });

  it('marks binary files as unsupported', async () => {
    await durable.writeFile(`orgs/${ORG_ID}/shared/blob.bin`, Buffer.from([0xff, 0xfe, 0x00, 0xc3, 0x28]), {
      recursive: true,
    });
    const { app } = await buildApp({ filesystem: durable, user: asUser });
    const file = (await (await app.request('/web/factory/fs/file?path=shared/blob.bin')).json()) as FactoryFsFile;
    expect(file.contentType).toBe('unsupported');
    expect(file.content).toBeUndefined();
  });
});
