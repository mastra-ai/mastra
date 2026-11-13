import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';
import { boardRegistryOf } from '../../boards/index.js';
import { createTestBoard, createTriageWorkRegistry } from '../../boards/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { createGithubPullRequestReconciler, GithubRules } from './rules.js';
import type { ReconcilePullRequestState } from './rules.js';

async function setup() {
  const seeded = await createFactoryStorageForTests(new LibSQLFactoryStorage({ id: 'github-label-refresh', url: ':memory:' }));
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'PR labels' } });
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const installation = await sourceControl.installations.upsert({ orgId: 'org-1', connectedByUserId: 'user-1', externalId: '7' });
  const repository = await sourceControl.repositories.upsert({ orgId: 'org-1', input: { installationId: installation.id, externalId: '10', slug: 'acme/repo', defaultBranch: 'main' } });
  const connection = await sourceControl.connections.create({ orgId: 'org-1', factoryProjectId: project.id, installationId: installation.id, createdByUserId: 'user-1' });
  await sourceControl.projectRepositories.link({ orgId: 'org-1', connectionId: connection.id, repositoryId: repository.id, createdByUserId: 'user-1', sandboxProvider: 'local', sandboxWorkdir: '/workspace' });
  const boards = boardRegistryOf([...createTriageWorkRegistry().values(), createTestBoard({ id: 'security' })]);
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  for (const route of (await seeded.boards.listIntakeRoutes(scope)).toReversed()) {
    await seeded.boards.deleteIntakeRoute(scope, route.id, { expectedRevision: route.revision });
  }
  await seeded.boards.createIntakeRoute(scope, { name: 'Security', when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'security' }] }, target: { boardKey: 'security', phaseKey: 'queued' } }, 'admin');
  await seeded.boards.createIntakeRoute(scope, { name: 'Other PRs', when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] }, target: { boardKey: 'work', phaseKey: 'intake' } }, 'admin');
  const card = await seeded.workItems.upsert({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, input: { externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:17', url: 'https://github.com/acme/repo/pull/17' }, title: 'PR 17', stages: ['intake'], sessions: {}, metadata: {} } });
  const options = { github: { getRepositoryCollaboratorPermission: vi.fn().mockResolvedValue('write') } as never, sourceControl, integrationStorage: seeded.integrations.forIntegration('github'), projects: seeded.projects, storage: seeded.workItems, configVersion: 'test', boards, intakeRoutes: seeded.boards };
  const get = () => seeded.workItems.get({ orgId: 'org-1', id: card.item.id });
  return { ...seeded, project, options, get };
}

function event(action: 'labeled' | 'unlabeled', labels: string[], deliveryId: string) {
  return { event: 'pull_request', deliveryId, payload: { action, installation: { id: 7 }, repository: { id: 10, full_name: 'acme/repo' }, sender: { login: 'maintainer' }, pull_request: { number: 17, labels: labels.map(name => ({ name })) } } };
}

describe('GitHub pull request label refresh', () => {
  it('updates source labels and routes an untouched card on label webhooks without creating another work item', async () => {
    const context = await setup();
    const rules = new GithubRules(context.options);
    await expect(rules.ingest(event('labeled', ['security'], 'add-security'))).resolves.toEqual({ status: 'committed' });
    expect(await context.get()).toMatchObject({ board: 'security', stages: ['queued'], workItem: { labels: ['security'], sources: [{ labels: ['security'] }] } });
    await expect(rules.ingest(event('labeled', ['security'], 'repeat-security'))).resolves.toEqual({ status: 'ignored' });
    await expect(rules.ingest(event('unlabeled', [], 'remove-security'))).resolves.toEqual({ status: 'committed' });
    expect(await context.get()).toMatchObject({ board: 'work', stages: ['intake'], workItem: { labels: [], sources: [{ labels: [] }] } });
    expect(await context.workItems.list({ orgId: 'org-1', factoryProjectId: context.project.id })).toHaveLength(1);
  });

  it('backfills historical empty source labels during reconciliation, then remains idempotent', async () => {
    const context = await setup();
    let labels = ['security'];
    const fetch = vi.fn(async (): Promise<ReconcilePullRequestState> => ({ title: 'PR 17', url: 'https://github.com/acme/repo/pull/17', state: 'open', draft: false, merged: false, labels, createdAt: '2030-01-01T00:00:00Z' }));
    const reconcile = createGithubPullRequestReconciler(context.options, fetch);
    const repositories = [{ id: 10, fullName: 'acme/repo', installationId: 7 }];
    await reconcile(repositories);
    expect(await context.get()).toMatchObject({ board: 'security', workItem: { labels: ['security'], sources: [{ labels: ['security'] }] } });
    const revision = (await context.get())!.revision;
    const sourceRevision = (await context.get())!.workItem.sources[0]!.revision;
    await reconcile(repositories);
    expect((await context.get())!.revision).toBe(revision);
    expect((await context.get())!.workItem.sources[0]!.revision).toBe(sourceRevision);
    labels = [];
    await reconcile(repositories);
    expect(await context.get()).toMatchObject({ board: 'work', stages: ['intake'], workItem: { labels: [], sources: [{ labels: [] }] } });
    expect(await context.workItems.list({ orgId: 'org-1', factoryProjectId: context.project.id })).toHaveLength(1);
  });
});
