import { RequestContext } from '@mastra/core/request-context';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';

import { MastraFactory } from './factory.js';
import { GithubIntegration } from './integrations/github/integration.js';
import { createFactorySecretEncryption } from './secret-encryption.js';
import { FACTORY_TEST_CHECK_NAME } from './session/source-control-tools.js';
import type { FactoryProjectsStorage } from './storage/domains/projects/base.js';
import type { SourceControlStorage } from './storage/domains/source-control/base.js';
import type { WorkItemsStorage } from './storage/domains/work-items/base.js';
import { createIsolatedFactoryPostgresForTests } from './storage/test-utils.js';

const prepareMock = vi.hoisted(() =>
  vi.fn(async (config: Record<string, unknown>) => ({
    base: { controller: { onSessionCreated: vi.fn(), setChannels: vi.fn(), queryThreadById: vi.fn() } },
    mastraArgs: { __capturedConfig: config },
    finalize: vi.fn(async () => {}),
  })),
);

vi.mock('@mastra/code-sdk', () => ({
  prepareAgentControllerMount: (config: Record<string, unknown>) => prepareMock(config),
}));

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const head = 'cd1e5903851234567890abcdef1234567890abcd';

type ExtraTools = (args: { requestContext: RequestContext }) => Promise<Record<string, any>>;

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('the review test check on %s', backend => {
  it('publishes whenever the review skill calls the tool, whatever the project stored for the old switch', async () => {
    prepareMock.mockClear();
    const storage =
      backend === 'postgres'
        ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
        : new LibSQLFactoryStorage({ id: 'review-test-check', url: ':memory:' });
    const github = new GithubIntegration({
      appId: '123',
      privateKey: 'test-key',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      slug: 'review-test-check',
    });
    // Records what Factory would send to GitHub instead of calling it.
    const published: unknown[] = [];
    vi.spyOn(github.versionControl, 'getRepositoryTarget').mockResolvedValue({
      connection: { type: 'oauth', accessToken: 'server-opaque' },
      sourceId: 'acme/app',
    } as never);
    vi.spyOn(github.versionControl, 'getPullRequest').mockResolvedValue({
      id: '17',
      state: 'open',
      headSha: head,
      headBranch: 'factory/issue-1',
    } as never);
    vi.spyOn(github.versionControl, 'publishCommitCheck').mockImplementation(async input => {
      published.push(input);
      return { id: '9', name: input.name, headSha: input.headSha, status: input.status, url: null };
    });

    const factory = new MastraFactory({
      storage,
      auth: null,
      integrations: [github],
      stateSecret: 'review-test-check-state-secret',
      secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
    });
    await factory.prepare();
    const config = prepareMock.mock.calls[0]![0];
    await storage.init();

    // A new project: the retired `review_test_checks_enabled` column holds its default, false.
    const project = await storage
      .getDomain<FactoryProjectsStorage>('projects')
      .create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Shipyard' } });
    const sourceControl = storage.getDomain<SourceControlStorage>('source-control').forIntegration('github');
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '123',
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '456', slug: 'acme/app', defaultBranch: 'main' },
    });
    const connection = await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const projectRepository = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/app',
    });
    await sourceControl.sessions.create({
      sessionId: 'session-1',
      projectRepositoryId: projectRepository.id,
      factoryProjectId: project.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/review-17',
      baseBranch: 'main',
    });
    // The Review run on pull request 17's card.
    await storage.getDomain<WorkItemsStorage>('work-items').prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      workItem: {
        input: {
          externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:17' },
          title: 'Review pull request 17',
          stages: ['pr-review'],
          sessions: {},
          metadata: { authorTrusted: true },
        },
      },
      role: 'review',
      session: { sessionId: 'session-1', branch: 'factory/review-17', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-review-17',
      kickoffMessage: null,
    });

    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
    requestContext.set('controller', {
      resourceId: 'resource-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      getState: () => ({ factoryProjectId: project.id, projectRepositoryId: projectRepository.id }),
    });
    const tools = await (config.extraTools as ExtraTools)({ requestContext });

    await expect(
      tools.source_control_publish_test_check.execute(
        {
          changeRequestId: 17,
          headSha: head,
          status: 'success',
          title: 'All planned tests passed',
          summary: '3 commands passed',
        },
        { requestContext },
      ),
    ).resolves.toMatchObject({ id: '9', name: FACTORY_TEST_CHECK_NAME });
    expect(published).toEqual([
      expect.objectContaining({
        headSha: head,
        name: FACTORY_TEST_CHECK_NAME,
        status: 'success',
        sourceId: 'acme/app',
      }),
    ]);
  });
});
