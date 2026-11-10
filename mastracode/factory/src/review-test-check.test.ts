import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { MastraFactory } from './factory.js';
import { GithubIntegration } from './integrations/github/integration.js';
import { createFactorySecretEncryption } from './secret-encryption.js';
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

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'a test check tool the app passes in on %s',
  backend => {
    async function reviewRun() {
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

      // The app's own tool, built on the change request the Review run reviews.
      const factory: MastraFactory = new MastraFactory({
        storage,
        auth: null,
        integrations: [github],
        tools: {
          publish_test_check: createTool({
            id: 'publish_test_check',
            description: 'Publish the review test check on the reviewed head.',
            inputSchema: z.object({ headSha: z.string(), status: z.enum(['success', 'failure']), summary: z.string() }),
            execute: async (input, context) => {
              const reviewed = await factory.reviewedChangeRequest(context.requestContext!);
              if (!reviewed) throw new Error('Only a Review run can publish a test check.');
              return reviewed.publishCommitCheck({ ...input, name: 'Shipyard / tests', title: input.summary });
            },
          }),
        },
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
      return { factory, tools, requestContext, published, github };
    }

    it('offers Factory sessions no test check tool of their own', async () => {
      const { tools } = await reviewRun();
      expect(tools).not.toHaveProperty('source_control_publish_test_check');
      expect(tools).toHaveProperty('publish_test_check');
    });

    it('publishes a check on the head of the change request the run reviews', async () => {
      const { factory, tools, requestContext, published } = await reviewRun();
      await expect(factory.reviewedChangeRequest(requestContext)).resolves.toMatchObject({
        provider: 'github',
        repository: 'acme/app',
        changeRequestId: '17',
        headSha: head,
        headBranch: 'factory/issue-1',
      });
      await expect(
        tools.publish_test_check.execute(
          { headSha: head, status: 'success', summary: '3 commands passed' },
          { requestContext },
        ),
      ).resolves.toMatchObject({ id: '9', name: 'Shipyard / tests' });
      expect(published).toEqual([
        expect.objectContaining({
          headSha: head,
          name: 'Shipyard / tests',
          status: 'success',
          sourceId: 'acme/app',
          ref: 'factory/issue-1',
        }),
      ]);
    });

    it("refuses a head that is not the change request's current head", async () => {
      const { tools, requestContext, published } = await reviewRun();
      await expect(
        tools.publish_test_check.execute(
          { headSha: 'f'.repeat(40), status: 'success', summary: '3 commands passed' },
          { requestContext },
        ),
      ).rejects.toThrow(/is not the current change-request head/);
      expect(published).toEqual([]);
    });

    it('has no change request for a run that is not a Review run', async () => {
      const { factory } = await reviewRun();
      const builder = new RequestContext();
      builder.set('user', { workosId: 'user-1', organizationId: 'org-1' });
      builder.set('controller', {
        resourceId: 'resource-2',
        sessionId: 'session-2',
        threadId: 'thread-2',
        getState: () => ({}),
      });
      await expect(factory.reviewedChangeRequest(builder)).resolves.toBeUndefined();
    });
  },
);
