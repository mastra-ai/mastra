import { createHmac } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { FactoryStartCoordinator } from '../../rules/start-coordinator.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { PlatformApiClient } from '../platform/api-client.js';
import { PlatformGithubEventWorker } from '../platform/github/event-worker.js';
import comments from './__fixtures__/pr-comments.json';
import { resolveGithubRules } from './default-rules.js';
import type { GithubRuleOverrides } from './default-rules.js';
import { GithubRules } from './rules.js';
import { subscribeToPullRequest } from './subscriptions.js';
import { handleGithubWebhook } from './webhook.js';
import type { ParsedGithubWebhook } from './webhook.js';

async function setup(permission: string | undefined, rules?: GithubRuleOverrides) {
  const seeded = await createFactoryStorageForTests();
  const workItems = seeded.workItems;
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const integrationStorage = seeded.integrations.forIntegration<
    Record<string, unknown>,
    Record<string, unknown>,
    { kind: 'factory-pr-provenance'; factoryProjectId: string; workItemId: string }
  >('github');
  const project = await seeded.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'Project 1' },
  });
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: '7',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '10', slug: 'acme/repo', defaultBranch: 'main' },
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
    sandboxWorkdir: '/workspace',
  });
  const github = {
    rules: resolveGithubRules(rules),
    slug: 'factory-app',
    getRepositoryCollaboratorPermission: vi.fn().mockResolvedValue(permission),
  };
  return {
    sourceControl,
    integrationStorage,
    workItems,
    projects: seeded.projects,
    project,
    projectRepository,
    github,
  };
}

interface FeedbackCase {
  label: string;
  login: string;
  body: string;
  permission: string;
  event?: string;
  action?: string;
  disableRules?: boolean;
  noBinding?: boolean;
  replay?: boolean;
  ruleCount: number;
  subscriptionCount: number;
}

// Exercise real storage, rule commits and dispatch through both ingress paths.
// Only the platform transport and agent execution are mocked.
const cases: FeedbackCase[] = [
  ...comments.map(c => ({
    label: c.login,
    login: c.login,
    body: c.body,
    permission: 'read',
    ruleCount: c.login === 'vercel[bot]' ? 0 : 1,
    subscriptionCount: 0,
  })),
  {
    label: 'standalone no findings',
    login: 'coderabbitai[bot]',
    body: 'No actionable comments were generated in the recent review. 🎉',
    permission: 'read',
    ruleCount: 0,
    subscriptionCount: 0,
  },
  {
    label: 'CodeRabbit inline finding',
    login: 'coderabbitai[bot]',
    body: 'P1: Missing null check.',
    permission: 'read',
    event: 'pull_request_review_comment',
    ruleCount: 0,
    subscriptionCount: 1,
  },
  {
    label: 'human with write',
    login: 'maintainer',
    body: 'Please fix the null case.',
    permission: 'write',
    ruleCount: 1,
    subscriptionCount: 0,
  },
  {
    label: 'human with read',
    login: 'contributor',
    body: 'Please fix the null case.',
    permission: 'read',
    ruleCount: 1,
    subscriptionCount: 0,
  },
  {
    label: 'Factory progress',
    login: 'factory-app[bot]',
    body: 'No action needed.',
    permission: 'read',
    ruleCount: 0,
    subscriptionCount: 0,
  },
  {
    label: 'Factory request changes',
    login: 'factory-app[bot]',
    body: 'Verdict: request changes\nFix null handling.',
    permission: 'read',
    ruleCount: 1,
    subscriptionCount: 0,
  },
  {
    label: 'CodeRabbit substantive',
    login: 'coderabbitai[bot]',
    body: 'P1: This dereferences null on an empty response.',
    permission: 'read',
    ruleCount: 1,
    subscriptionCount: 0,
  },
  {
    label: 'mixed bot summary and finding',
    login: 'coderabbitai[bot]',
    body: '<!-- This is an auto-generated comment: summarize by coderabbit.ai -->\nNo actionable comments were generated in the recent review. 🎉\nP1: Fix the null dereference.',
    permission: 'read',
    ruleCount: 1,
    subscriptionCount: 0,
  },
  {
    label: 'failed deployment',
    login: 'vercel[bot]',
    body: '[vc]: #metadata\nDeployment failed.',
    permission: 'read',
    ruleCount: 1,
    subscriptionCount: 0,
  },
  {
    label: 'subscription fallback when rule disabled',
    login: 'coderabbitai[bot]',
    body: 'P1: Fix null handling.',
    permission: 'read',
    disableRules: true,
    ruleCount: 0,
    subscriptionCount: 1,
  },
  {
    label: 'subscription fallback without a live Work binding',
    login: 'coderabbitai[bot]',
    body: 'Fix the null case.',
    permission: 'read',
    noBinding: true,
    ruleCount: 0,
    subscriptionCount: 1,
  },
  {
    label: 'replay uses committed decision after rule is disabled',
    login: 'coderabbitai[bot]',
    body: 'Fix the null case.',
    permission: 'read',
    replay: true,
    ruleCount: 1,
    subscriptionCount: 0,
  },
  {
    label: 'changes-requested review',
    login: 'maintainer',
    body: 'Fix the null case.',
    permission: 'write',
    event: 'pull_request_review',
    action: 'submitted',
    ruleCount: 1,
    subscriptionCount: 0,
  },
];

for (const transport of ['direct', 'platform']) {
  it.each(cases)(`${transport}: $label`, async fixture => {
    const { github, sourceControl, integrationStorage, workItems, projects, project, projectRepository } = await setup(
      'read',
      fixture.disableRules ? { pullRequestCommentCreated: null } : undefined,
    );
    const configVersion = 'factory-config-v1';
    const transitionService = new FactoryTransitionService({
      storage: workItems,
      configVersion,
      boards: createBoardRegistry(),
    });
    const service = new GithubRules({
      github: github as never,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      boards: createBoardRegistry(),
      configVersion,
    });

    const notifications: Array<{ source: string; summary: string; options?: { ifIdle?: { behavior?: string } } }> = [];
    let threadId: string | undefined = 'thread-work';
    const session = {
      thread: {
        getId: () => threadId,
        list: vi.fn(async () => []),
        create: vi.fn(async () => {
          threadId = 'thread-work';
          return { id: threadId };
        }),
        switch: vi.fn(async ({ threadId: next }: { threadId: string }) => {
          threadId = next;
        }),
        setSetting: vi.fn(async () => {}),
        rename: vi.fn(async () => {}),
        requireId: vi.fn(() => {
          if (!threadId) throw new Error('Thread was not persisted before binding creation.');
          return threadId;
        }),
        listActiveMessages: vi.fn(async () => []),
      },
      getWorkspace: () => ({ skills: { maybeRefresh: vi.fn(async () => {}), get: vi.fn(async () => undefined) } }),
      subscribe: vi.fn(() => () => {}),
      state: {
        get: vi.fn(() => ({ factoryProjectId: project.id, factoryOrgId: 'org-1' })),
        set: vi.fn(async () => {}),
      },
      mode: { get: vi.fn(() => 'build') },
      model: { get: vi.fn(() => 'openai/gpt-5.6-sol') },
      identity: { getId: vi.fn(() => 'session-work-42'), getOwnerId: vi.fn(() => 'user-1') },
      permissions: { setForTool: vi.fn(async () => {}) },
      sendMessage: vi.fn(async () => {}),
      sendSignal: vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, action: 'wake' }) })),
      sendNotificationSignal: vi.fn(
        async (input: { source: string; summary: string }, options?: { ifIdle?: { behavior?: string } }) => (
          notifications.push({ ...input, options }),
          {
            persisted: Promise.resolve(),
            accepted: Promise.resolve({ action: 'wake', output: { consumeStream: async () => {} } }),
          }
        ),
      ),
    };
    const controller = {
      queryThreadById: async () => ({ id: 'thread-work', resourceId: 'session-work-42' }),
      createSession: vi.fn(async () => session),
      getSessionByResource: vi.fn(async () => session),
    };
    await sourceControl.sessions.create({
      sessionId: 'session-work-42',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/issue-42',
      baseBranch: 'main',
    });
    const coordinator = new FactoryStartCoordinator(controller as never, workItems, transitionService, sourceControl);
    const prepared = await coordinator.prepare({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      sessionId: 'session-work-42',
      threadTitle: 'Issue 42',
      kickoffKey: 'kickoff-work-42',
      destinationStage: 'execute',
      workItem: {
        role: 'work',
        input: {
          externalSource: {
            integrationId: 'github',
            type: 'issue',
            externalId: 'github:10:issue:42',
            url: 'https://github.com/acme/repo/issues/42',
          },
          title: 'Issue 42',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
    });
    await integrationStorage.subscriptions.create({
      orgId: 'org-1',
      targetKey: 'factory-pr-provenance:10:17',
      threadId: 'thread-work',
      status: 'active',
      data: { kind: 'factory-pr-provenance', factoryProjectId: project.id, workItemId: prepared.workItemId },
    });
    if (fixture.noBinding) {
      await workItems.revokeRunBindingsForWorkItem({
        orgId: 'org-1',
        factoryProjectId: project.id,
        workItemId: prepared.workItemId,
        revokedAt: new Date(),
      });
    }
    const ingestFactoryEvent = async (event: ParsedGithubWebhook) => {
      const result = await service.ingest(event);
      if (!fixture.replay) return result;
      github.rules = resolveGithubRules({ pullRequestCommentCreated: null });
      const replay = await service.ingest(event);
      expect(replay).toEqual({ ...result, status: 'replayed' });
      expect(replay.feedbackTargets).toEqual([
        { orgId: 'org-1', sessionId: 'session-work-42', threadId: 'thread-work' },
      ]);
      return replay;
    };
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage: workItems,
      boards: createBoardRegistry(),
      isAutoRunEnabled: async () => true,
      ownerId: 'worker-1',
    });

    github.getRepositoryCollaboratorPermission.mockResolvedValue(fixture.permission);
    Object.assign(github, {
      webhookSecret: 'local-test-secret',
      integrationStorage: integrationStorage,
      sourceControlStorage: sourceControl,
      authorizedBots: [],
    });
    await subscribeToPullRequest(
      {
        orgId: 'org-1',
        installationExternalId: '7',
        repositoryExternalId: '10',
        repositorySlug: 'acme/repo',
        changeRequestId: '17',
        projectRepositoryId: projectRepository.id,
        sessionId: 'session-work-42',
        ownerId: 'user-1',
        resourceId: 'session-work-42',
        threadId: 'thread-work',
        source: 'factory-pr-create',
        subscribedByUserId: 'user-1',
      },
      integrationStorage as never,
    );
    const parsed: ParsedGithubWebhook = {
      event: fixture.event ?? 'issue_comment',
      deliveryId: 'repro-delivery',
      payload: {
        action: fixture.action ?? 'created',
        installation: { id: 7 },
        repository: { id: 10, full_name: 'acme/repo' },
        ...(fixture.event?.startsWith('pull_request_review')
          ? {
              pull_request: {
                number: 17,
                state: 'open',
                title: 'Docs-only PR',
                html_url: 'https://github.com/acme/repo/pull/17',
              },
            }
          : {}),
        ...(fixture.event === 'pull_request_review'
          ? {
              review: {
                id: 556,
                state: 'changes_requested',
                body: fixture.body,
                user: { login: fixture.login },
                html_url: 'https://github.com/acme/repo/pull/17#pullrequestreview-556',
              },
            }
          : {}),
        sender: { login: fixture.login, type: fixture.login.endsWith('[bot]') ? 'Bot' : 'User' },
        comment: {
          id: 555,
          body: fixture.body,
          html_url: 'https://github.com/acme/repo/pull/17#issuecomment-555',
          user: { login: fixture.login, type: fixture.login.endsWith('[bot]') ? 'Bot' : 'User' },
        },
        issue: {
          number: 17,
          title: 'Docs-only PR',
          state: 'open',
          html_url: 'https://github.com/acme/repo/pull/17',
          pull_request: { url: 'https://api.github.com/repos/acme/repo/pulls/17' },
        },
      },
    };
    if (transport === 'direct') {
      const body = JSON.stringify(parsed.payload);
      const signature = 'sha256=' + createHmac('sha256', 'local-test-secret').update(body).digest('hex');
      const headers: Record<string, string> = {
        'x-github-event': parsed.event,
        'x-github-delivery': parsed.deliveryId,
        'x-hub-signature-256': signature,
      };
      const response = await handleGithubWebhook(
        { req: { header: (name: string) => headers[name], text: async () => body } } as never,
        {
          github: github as never,
          controller: controller as never,
          ingestFactoryEvent,
        },
      );
      expect(response.status).toBe(202);
    } else {
      let finishPage!: () => void;
      const pageFinished = new Promise<void>(resolve => {
        finishPage = resolve;
      });
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const worker = new PlatformGithubEventWorker({
        controller: controller as never,
        github: github as never,
        sourceControl,
        ingestFactoryEvent,
        client: new PlatformApiClient({
          baseUrl: 'https://platform.example.com',
          accessToken: 'fake',
          fetchImpl: async input => {
            const url = new URL(String(input));
            if (!url.pathname.endsWith('/repositories/10/events'))
              throw new Error('Unexpected local fixture request: ' + url.pathname);
            return Response.json(
              url.searchParams.has('afterTimestamp')
                ? {
                    events: [{ ...parsed, id: '1000-0' }],
                    nextCursor: '1000-0',
                  }
                : { events: [], nextCursor: null },
            );
          },
        }),
        storage: {
          settings: {
            get: async () => null,
            save: async (
              _org: string,
              _user: string,
              value: { repositories: Record<string, { afterEventId?: string }> },
            ) => {
              if (value.repositories['10']?.afterEventId === '1000-0') finishPage();
            },
          },
        } as never,
        intervalMs: 60000,
      });
      await worker.init({ pubsub: {}, storage: {}, logger } as never);
      try {
        await worker.start();
        await pageFinished;
      } finally {
        await worker.stop();
      }
      expect(logger.error).not.toHaveBeenCalled();
    }
    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    const ruleNotifications = notifications.filter(n => n.source === 'factory');
    const subscriptionNotifications = notifications.filter(n => n.source === 'github');
    expect(ruleNotifications).toHaveLength(fixture.ruleCount);
    expect(subscriptionNotifications).toHaveLength(fixture.subscriptionCount);
    for (const notification of ruleNotifications) {
      expect(notification.options?.ifIdle?.behavior).toBe('wake');
      expect(notification.summary).toContain('finish silently without posting a no-action summary');
    }
    for (const notification of subscriptionNotifications) {
      expect(notification.summary).toContain('finish silently without posting a no-action summary');
    }
  });
}
