import { describe, expect, it, vi } from 'vitest';
import { builtInFactoryRules, defaultFactoryRules } from '../../rules/defaults.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { FactoryStartCoordinator } from '../../rules/start-coordinator.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import { FACTORY_PULL_REQUEST_RECONCILIATION_KEY } from '../../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { GithubAppIdentity } from './app-identity.js';
import { createGithubPullRequestReconciler, GithubRules, reconciledClosedEvent } from './rules.js';
import type { ReconcileIssueState, ReconcilePullRequestState } from './rules.js';
import { changeRequestTargetKey } from './subscriptions.js';

async function setup(permission: string | undefined) {
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
    slug: 'factory-app',
    getRepositoryCollaboratorPermission: vi.fn().mockResolvedValue(permission),
  } as unknown as GithubIntegration;
  return {
    sourceControl,
    integrationStorage,
    // Same rows as `integrationStorage`, typed for the subscription payloads the
    // reconciler retires rather than the provenance payloads the rules read.
    subscriptionStorage: seeded.integrations.forIntegration('github'),
    workItems,
    projects: seeded.projects,
    project,
    projectRepository,
    github,
  };
}

function issueOpened(deliveryId = 'delivery-1', createdAt = '2030-01-01T00:00:00Z') {
  return {
    event: 'issues',
    deliveryId,
    payload: {
      action: 'opened',
      installation: { id: 7 },
      repository: { id: 10, full_name: 'acme/repo' },
      sender: { login: 'maintainer' },
      issue: {
        number: 42,
        title: 'Issue 42',
        html_url: 'https://github.com/acme/repo/issues/42',
        created_at: createdAt,
      },
    },
  };
}

function issueClosed(deliveryId = 'delivery-closed-1', stateReason?: string) {
  return {
    event: 'issues',
    deliveryId,
    payload: {
      action: 'closed',
      installation: { id: 7 },
      repository: { id: 10, full_name: 'acme/repo' },
      sender: { login: 'maintainer' },
      issue: {
        number: 42,
        title: 'Issue 42',
        html_url: 'https://github.com/acme/repo/issues/42',
        state: 'closed',
        ...(stateReason ? { state_reason: stateReason } : {}),
      },
    },
  };
}

function issueComment(
  action: 'created' | 'edited' | 'deleted',
  deliveryId: string,
  options: { sender?: string; author?: string; body?: string } = {},
) {
  const sender = options.sender ?? 'contributor';
  const author = options.author ?? sender;
  const body = options.body ?? 'New details';
  return {
    event: 'issue_comment',
    deliveryId,
    payload: {
      action,
      installation: { id: 7 },
      repository: { id: 10, full_name: 'acme/repo' },
      sender: { login: sender },
      issue: {
        number: 42,
        title: 'Issue 42',
        html_url: 'https://github.com/acme/repo/issues/42',
      },
      comment: {
        id: 100,
        body,
        user: { login: author, type: author.endsWith('[bot]') ? 'Bot' : 'User' },
      },
    },
  };
}

function pullRequestComment(
  deliveryId: string,
  options: { action?: 'created' | 'edited' | 'deleted'; sender?: string; author?: string; body?: string; state?: string } = {},
) {
  const sender = options.sender ?? 'maintainer';
  const author = options.author ?? sender;
  return {
    event: 'issue_comment',
    deliveryId,
    payload: {
      action: options.action ?? 'created',
      installation: { id: 7 },
      repository: { id: 10, full_name: 'acme/repo' },
      sender: { login: sender },
      issue: {
        number: 17,
        title: 'PR 17',
        html_url: 'https://github.com/acme/repo/pull/17',
        state: options.state ?? 'open',
        pull_request: {},
        user: { login: 'pr-author' },
      },
      comment: {
        id: 101,
        body: options.body ?? '@factory-app review',
        user: { login: author, type: author.endsWith('[bot]') ? 'Bot' : 'User' },
      },
    },
  };
}

async function createLinkedIssue(
  workItems: Awaited<ReturnType<typeof createFactoryStorageForTests>>['workItems'],
  projectId: string,
) {
  return (
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: projectId,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
        title: 'Issue 42',
        stages: ['planning'],
        sessions: {},
        metadata: {},
      },
    })
  ).item;
}

function pullRequest(
  event: 'opened' | 'closed' | 'synchronize',
  deliveryId: string,
  merged = false,
  createdAt = '2030-01-01T00:00:00Z',
) {
  return {
    event: 'pull_request',
    deliveryId,
    payload: {
      action: event,
      installation: { id: 7 },
      repository: { id: 10, full_name: 'acme/repo' },
      sender: { login: 'contributor' },
      pull_request: {
        number: 17,
        title: 'PR 17',
        html_url: 'https://github.com/acme/repo/pull/17',
        created_at: createdAt,
        state: merged ? 'closed' : 'open',
        merged,
        head: { ref: 'feature' },
        base: { ref: 'main' },
      },
    },
  };
}

describe('GithubRules', () => {
  it('commits one trusted issue intake decision and replays immutable delivery ingress', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(service.ingest(issueOpened())).resolves.toEqual({ status: 'committed' });
    await expect(service.ingest(issueOpened())).resolves.toEqual({ status: 'replayed' });
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.actor).toMatchObject({ type: 'github', login: 'maintainer', trusted: true });
    expect(decisions[0]?.decision).toMatchObject({ type: 'upsertLinkedWorkItem', source: 'github-issue' });
  });

  it('moves an issue-backed work card to done when its issue closes as completed', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    await createLinkedIssue(workItems, project.id);
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(service.ingest(issueClosed('delivery-closed-done', 'completed'))).resolves.toEqual({
      status: 'committed',
    });
    await expect(service.ingest(issueClosed('delivery-closed-done', 'completed'))).resolves.toEqual({
      status: 'replayed',
    });

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.decision).toMatchObject({ type: 'transition', board: 'work', stage: 'done' });
  });

  it('cancels an issue-backed work card when its issue closes as not planned', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    await createLinkedIssue(workItems, project.id);
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(service.ingest(issueClosed('delivery-closed-np', 'not_planned'))).resolves.toEqual({
      status: 'committed',
    });

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.decision).toMatchObject({ type: 'transition', board: 'work', stage: 'canceled' });
  });

  it('never binds a close to another linked repository card with the same issue number', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    // Same canonical key (`github-issue:42`) but the card tracks other/repo#42.
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:42',
          url: 'https://github.com/other/repo/issues/42',
        },
        title: 'Issue 42 (other repo)',
        stages: ['planning'],
        sessions: {},
        metadata: { githubRepositoryId: 999 },
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    // acme/repo#42 closing must not move the other/repo#42 card.
    await expect(service.ingest(issueClosed('delivery-closed-cross-repo', 'completed'))).resolves.toEqual({
      status: 'committed',
    });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toHaveLength(0);
  });

  it('commits nothing when the closed issue card is already off the board', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
        title: 'Issue 42',
        stages: ['done'],
        sessions: {},
        metadata: {},
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(service.ingest(issueClosed('delivery-closed-terminal'))).resolves.toEqual({ status: 'committed' });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toHaveLength(0);
  });

  it('retriages a human comment containing the handoff marker', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    await createLinkedIssue(workItems, project.id);
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(
      service.ingest(
        issueComment('created', 'delivery-human-marker', {
          body: '<!-- mastra-factory-triage -->\nNew investigation lead',
        }),
      ),
    ).resolves.toEqual({ status: 'committed' });

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(1);
    const [decision] = decisions;
    expect(decision?.decision).toMatchObject({
      type: 'invokeSkill',
      skillName: 'factory-triage',
      idempotencyKey: '7:delivery-human-marker:factory-triage',
    });
  });

  it('ignores a marked handoff comment authored by the configured GitHub App', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    await createLinkedIssue(workItems, project.id);
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(
      service.ingest(
        issueComment('edited', 'delivery-factory-handoff', {
          sender: 'factory-app[bot]',
          author: 'factory-app[bot]',
          body: '<!-- mastra-factory-triage -->\nUpdated handoff',
        }),
      ),
    ).resolves.toEqual({ status: 'ignored' });

    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('ignores its own handoff comment when only the resolved identity names the App', async () => {
    // Regression: a Platform deployment has no configured slug, because that
    // slug names a *different*, self-hosted App. Recognition therefore has to
    // come from the resolved identity. Without it Factory's own handoff woke
    // triage and cancelled the run that had just written it.
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    await createLinkedIssue(workItems, project.id);
    const service = new GithubRules({
      github: {
        ...github,
        slug: undefined,
        identity: new GithubAppIdentity('mastra-platform'),
      } as unknown as GithubIntegration,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(
      service.ingest(
        issueComment('created', 'delivery-platform-handoff', {
          sender: 'mastra-platform[bot]',
          author: 'mastra-platform[bot]',
          body: '<!-- mastra-factory-triage -->\nRoute: Pending',
        }),
      ),
    ).resolves.toEqual({ status: 'ignored' });

    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('still retriages a human handoff comment when the identity is resolved', async () => {
    // The guard must key on authorship, not on the marker: a human quoting the
    // marker to add a lead has to keep retriggering triage.
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    await createLinkedIssue(workItems, project.id);
    const service = new GithubRules({
      github: {
        ...github,
        slug: undefined,
        identity: new GithubAppIdentity('mastra-platform'),
      } as unknown as GithubIntegration,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(
      service.ingest(
        issueComment('created', 'delivery-human-lead', {
          body: '<!-- mastra-factory-triage -->\nNew investigation lead',
        }),
      ),
    ).resolves.toEqual({ status: 'committed' });

    expect(await workItems.listDeferredDecisions('org-1', project.id)).toHaveLength(1);
  });

  it('keeps trusted issues created before the Factory in Intake', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest(issueOpened('delivery-before-factory', '2000-01-01T00:00:00Z'));

    const [decision] = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decision?.decision).toMatchObject({ type: 'upsertLinkedWorkItem', stage: 'intake' });
  });

  it('moves a trusted issue through Intake to Triage with one investigation and rematerializes it after deletion', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project, projectRepository } =
      await setup('write');
    const rules = defaultFactoryRules({
      version: 'test-web-policy',
      overrides: {
        work: {
          intake: {
            issue: {
              onEnter: context => ({
                type: 'invokeSkill',
                idempotencyKey: `${context.ingress.id}:factory-triage`,
                role: 'triage',
                skillName: 'factory-triage',
                arguments: context.item.url ? `GitHub issue (${context.item.url})` : context.item.title,
              }),
            },
          },
        },
      },
    });
    const transitionService = new FactoryTransitionService({ storage: workItems, rules });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules,
    });
    const deliveredSignals: Array<{ id: string; contents: string; threadId: string; user: unknown }> = [];
    const sessions = new Map<string, ReturnType<typeof makeSession>>();

    function makeSession(key: string, initialThreadId?: string) {
      let threadId: string | undefined = initialThreadId;
      const agentEndListeners = new Set<(event: { type: string }) => void>();
      const session = {
        thread: {
          list: vi.fn(async () => []),
          create: vi.fn(async () => {
            threadId = 'thread-issue-42';
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
          listActiveMessages: vi.fn(async () => deliveredSignals.map(({ id }) => ({ id }))),
        },
        getWorkspace: () => ({
          skills: {
            maybeRefresh: vi.fn(async () => {}),
            get: vi.fn(async (name: string) => ({ name, instructions: 'Investigate the issue.' })),
          },
        }),
        sendSignal: vi.fn(
          (input: { id: string; contents: string }, options: { requestContext: { get(key: string): unknown } }) => {
            if (!threadId) throw new Error('Signal delivered before thread persistence.');
            deliveredSignals.push({ ...input, threadId, user: options.requestContext.get('user') });
            for (const listener of agentEndListeners) {
              listener({ type: 'agent_end' });
            }
            return { accepted: Promise.resolve({ accepted: true, action: 'wake' }) };
          },
        ),
        subscribe: vi.fn((listener: (event: { type: string }) => void) => {
          agentEndListeners.add(listener);
          return () => agentEndListeners.delete(listener);
        }),
        state: { get: vi.fn(() => ({ factoryProjectId: project.id })), set: vi.fn(async () => {}) },
        mode: { get: vi.fn(() => 'build') },
        model: { get: vi.fn(() => 'openai/gpt-5.6-sol') },
        identity: { getId: vi.fn(() => key), getOwnerId: vi.fn(() => 'user-1') },
        permissions: { setForTool: vi.fn(async () => {}) },
        sendMessage: vi.fn(async () => {}),
        sendNotificationSignal: vi.fn(async () => ({ persisted: Promise.resolve(), accepted: Promise.resolve() })),
      };
      sessions.set(key, session);
      return session;
    }

    const controller = {
      createSession: vi.fn(async ({ id, threadId }: { id: string; threadId: string }) => makeSession(id, threadId)),
      getSessionByResource: vi.fn(async (resourceId: string) => sessions.get(resourceId)),
    };
    await sourceControl.sessions.create({
      sessionId: 'session-issue-42',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'factory/issue-42',
      baseBranch: 'main',
    });
    const coordinator = new FactoryStartCoordinator(controller as never, workItems, transitionService, sourceControl);
    const primeCredentials = vi.fn(async () => {});
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage: workItems,
      isAutoRunEnabled: async () => true,
      ownerId: 'worker-1',
      primeCredentials,
      prepareBinding: async ({ record, item, role }) => {
        await coordinator.prepare({
          orgId: record.orgId,
          userId: 'user-1',
          factoryProjectId: record.factoryProjectId,
          sessionId: 'session-issue-42',
          threadTitle: `Issue: ${item.title}`,
          kickoffKey: record.idempotencyKey,
          destinationStage: 'triage',
          workItem: { id: item.id, role, input: item },
        });
      },
    });

    await service.ingest(issueOpened('delivery-full-flow'));
    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    await dispatcher.runOnce(new Date('2030-01-01T00:00:01Z'));

    const [item] = await workItems.list({ orgId: 'org-1', factoryProjectId: project.id });
    expect(item).toMatchObject({
      externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:42' },
      stages: ['triage'],
      sessions: {
        triage: {
          sessionId: 'session-issue-42',
          branch: 'factory/issue-42',
          threadId: 'session-issue-42',
        },
      },
    });
    expect(primeCredentials).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(deliveredSignals).toEqual([
      expect.objectContaining({
        threadId: 'session-issue-42',
        contents: expect.stringContaining('<skill name="factory-triage">'),
        user: { workosId: 'user-1', organizationId: 'org-1' },
      }),
    ]);
    const deferredDecisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(deferredDecisions).toHaveLength(2);
    expect(deferredDecisions.map(decision => decision.status)).toEqual(['succeeded', 'succeeded']);
    expect(
      deferredDecisions.filter(
        decision => decision.decision.type === 'invokeSkill' && decision.decision.skillName === 'factory-triage',
      ),
    ).toHaveLength(1);

    await workItems.delete({ orgId: 'org-1', id: item!.id });
    await expect(service.ingest(issueOpened('delivery-full-flow'))).resolves.toEqual({ status: 'replayed' });
    expect((await workItems.listDeferredDecisions('org-1', project.id)).map(decision => decision.status)).toEqual([
      'retry',
      'succeeded',
    ]);

    await dispatcher.runOnce(new Date('2030-01-01T00:00:02Z'));
    await dispatcher.runOnce(new Date('2030-01-01T00:00:03Z'));

    const [rematerialized] = await workItems.list({ orgId: 'org-1', factoryProjectId: project.id });
    expect(rematerialized).toMatchObject({
      externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:42' },
      stages: ['triage'],
    });
    expect(rematerialized?.id).not.toBe(item?.id);
    expect(deliveredSignals).toHaveLength(2);
  });

  it('prefers canonical board identities over legacy GitHub rows during ingress', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    const issue = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
        title: 'Issue 42',
        stages: ['intake'],
        sessions: {},
        metadata: { number: 42 },
      },
    });
    const review = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'PR 17',
        stages: ['intake'],
        sessions: {},
        metadata: { number: 17 },
      },
    });
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github:10:issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
        title: 'Legacy issue 42',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github:10:pull-request:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'Legacy PR 17',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest(issueOpened('delivery-canonical-issue'));
    await service.ingest(pullRequest('opened', 'delivery-canonical-pr'));

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: issue.item.id,
          decision: expect.objectContaining({ source: 'github-issue' }),
        }),
        expect.objectContaining({
          workItemId: review.item.id,
          decision: expect.objectContaining({ source: 'github-pr' }),
        }),
      ]),
    );
  });

  it('materializes and starts the first Review pass when a trusted maintainer requests Factory', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    const rules = builtInFactoryRules();
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: { getSessionByResource: vi.fn(async () => undefined) } as never,
      transitionService: new FactoryTransitionService({ storage: workItems, rules }),
      storage: workItems,
      isAutoRunEnabled: async () => true,
      ownerId: 'worker-1',
    });
    const reviewRequested = (deliveryId: string, reviewer = 'factory-app[bot]') => ({
      event: 'pull_request',
      deliveryId,
      payload: {
        action: 'review_requested',
        installation: { id: 7 },
        repository: { id: 10, full_name: 'acme/repo' },
        sender: { login: 'maintainer' },
        requested_reviewer: { login: reviewer },
        pull_request: {
          number: 17,
          title: 'PR 17',
          html_url: 'https://github.com/acme/repo/pull/17',
          created_at: '2030-01-01T00:00:00Z',
          state: 'open',
          merged: false,
          user: { login: 'pr-author' },
          head: { ref: 'feature' },
          base: { ref: 'main' },
        },
      },
    });

    await expect(service.ingest(reviewRequested('delivery-review-requested'))).resolves.toEqual({ status: 'committed' });
    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [card] = await workItems.list({ orgId: 'org-1', factoryProjectId: project.id });
    expect(card).toMatchObject({
      title: 'PR 17',
      stages: ['intake'],
      metadata: {
        author: 'pr-author',
        authorTrusted: true,
        factoryAuthored: false,
        autoStartCandidate: true,
      },
    });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: card!.id,
          decision: expect.objectContaining({ type: 'invokeSkill', skillName: 'factory-review', role: 'review' }),
        }),
      ]),
    );

    await expect(service.ingest(reviewRequested('delivery-review-requested'))).resolves.toEqual({ status: 'replayed' });
    await expect(service.ingest(reviewRequested('delivery-review-requested-human', 'ada'))).resolves.toEqual({
      status: 'committed',
    });
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).toHaveLength(1);
  });

  it('materializes a Review card from Factory\'s exact PR comment command', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    const rules = builtInFactoryRules();
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: { getSessionByResource: vi.fn(async () => undefined) } as never,
      transitionService: new FactoryTransitionService({ storage: workItems, rules }),
      storage: workItems,
      isAutoRunEnabled: async () => true,
      ownerId: 'worker-1',
    });

    await expect(service.ingest(pullRequestComment('delivery-comment-review'))).resolves.toEqual({ status: 'committed' });
    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [card] = await workItems.list({ orgId: 'org-1', factoryProjectId: project.id });
    expect(card).toMatchObject({
      title: 'PR 17',
      stages: ['intake'],
      metadata: { author: 'pr-author', authorTrusted: true, factoryAuthored: false, autoStartCandidate: true },
    });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: card!.id,
          decision: expect.objectContaining({ type: 'invokeSkill', skillName: 'factory-review', role: 'review' }),
        }),
      ]),
    );

    await expect(service.ingest(pullRequestComment('delivery-comment-review'))).resolves.toEqual({ status: 'replayed' });
    await expect(
      service.ingest(pullRequestComment('delivery-comment-prose', { body: 'Please @factory-app review this PR.' })),
    ).resolves.toEqual({ status: 'committed' });
    await expect(
      service.ingest(pullRequestComment('delivery-comment-quoted', { body: '> @factory-app review' })),
    ).resolves.toEqual({ status: 'committed' });
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).toHaveLength(1);
  });

  it('does not materialize a Review card when an untrusted actor requests Factory', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(
      service.ingest({
        event: 'pull_request',
        deliveryId: 'delivery-review-requested-untrusted',
        payload: {
          action: 'review_requested',
          installation: { id: 7 },
          repository: { id: 10, full_name: 'acme/repo' },
          sender: { login: 'contributor' },
          requested_reviewer: { login: 'factory-app[bot]' },
          pull_request: {
            number: 17,
            title: 'PR 17',
            html_url: 'https://github.com/acme/repo/pull/17',
            created_at: '2030-01-01T00:00:00Z',
            state: 'open',
            merged: false,
            user: { login: 'pr-author' },
            head: { ref: 'feature' },
            base: { ref: 'main' },
          },
        },
      }),
    ).resolves.toEqual({ status: 'committed' });
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).toEqual([]);
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);

    await expect(
      service.ingest(pullRequestComment('delivery-comment-review-untrusted', { sender: 'contributor' })),
    ).resolves.toEqual({ status: 'committed' });
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).toEqual([]);
  });

  it('ignores comment commands until Factory can resolve its own GitHub identity', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    (github as { slug?: string }).slug = undefined;
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(service.ingest(pullRequestComment('delivery-comment-review-unknown-identity'))).resolves.toEqual({
      status: 'committed',
    });
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).toEqual([]);
  });

  it('commits a re-review transition when review is re-requested from the Factory bot', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    const reviewed = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'PR 17',
        stages: ['done'],
        sessions: {},
        metadata: { authorTrusted: true },
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    const reviewRequested = (deliveryId: string, reviewer: string) => ({
      event: 'pull_request',
      deliveryId,
      payload: {
        action: 'review_requested',
        installation: { id: 7 },
        repository: { id: 10, full_name: 'acme/repo' },
        sender: { login: 'maintainer' },
        requested_reviewer: { login: reviewer },
        pull_request: {
          number: 17,
          title: 'PR 17',
          html_url: 'https://github.com/acme/repo/pull/17',
          created_at: '2030-01-01T00:00:00Z',
          state: 'open',
          merged: false,
          head: { ref: 'feature' },
          base: { ref: 'main' },
        },
      },
    });

    // A human reviewer re-request is not Factory's signal: no decision.
    expect(await service.ingest(reviewRequested('delivery-rr-human', 'ada'))).toEqual({ status: 'committed' });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);

    // Re-requesting from Factory's own bot restarts the review pass.
    expect(await service.ingest(reviewRequested('delivery-rr-factory', 'factory-app[bot]'))).toEqual({
      status: 'committed',
    });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([
      expect.objectContaining({
        workItemId: reviewed.item.id,
        decision: expect.objectContaining({ type: 'transition', board: 'review', stage: 'review' }),
      }),
    ]);

    await expect(
      service.ingest(pullRequestComment('delivery-rr-comment', { body: '@factory-app re-review' })),
    ).resolves.toEqual({ status: 'committed' });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: reviewed.item.id,
          decision: expect.objectContaining({ type: 'transition', board: 'review', stage: 'review' }),
        }),
      ]),
    );
  });

  it('re-reviews a Factory-authored PR: provenance binds neither the card nor the human requester', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    // The Work item Factory implemented the PR from, bound by provenance.
    const work = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
        title: 'Issue 42',
        stages: ['execute'],
        sessions: {},
        metadata: {},
      },
    });
    await integrationStorage.subscriptions.create({
      orgId: 'org-1',
      targetKey: 'factory-pr-provenance:10:17',
      threadId: 'thread-1',
      status: 'active',
      data: { kind: 'factory-pr-provenance', factoryProjectId: project.id, workItemId: work.item.id },
    });
    // The PR's own Review card, already reviewed once.
    const card = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'PR 17',
        stages: ['done'],
        sessions: {},
        metadata: { authorTrusted: true },
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(
      service.ingest({
        event: 'pull_request',
        deliveryId: 'delivery-rr-provenance',
        payload: {
          action: 'review_requested',
          installation: { id: 7 },
          repository: { id: 10, full_name: 'acme/repo' },
          sender: { login: 'maintainer' },
          requested_reviewer: { login: 'factory-app[bot]' },
          pull_request: {
            number: 17,
            title: 'PR 17',
            html_url: 'https://github.com/acme/repo/pull/17',
            created_at: '2030-01-01T00:00:00Z',
            state: 'open',
            merged: false,
            head: { ref: 'feature' },
            base: { ref: 'main' },
          },
        },
      }),
    ).resolves.toEqual({ status: 'committed' });

    // The re-review lands on the PR's Review card, not the provenance-bound Work item.
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([
      expect.objectContaining({
        workItemId: card.item.id,
        decision: expect.objectContaining({ type: 'transition', board: 'review', stage: 'review' }),
      }),
    ]);
  });

  it('dispatches a re-review transition back into Reviewing and queues a fresh factory-rereview pass', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    const card = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'PR 17',
        stages: ['done'],
        sessions: {},
        metadata: { authorTrusted: true },
      },
    });
    const rules = builtInFactoryRules();
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: { getSessionByResource: vi.fn(async () => undefined) } as never,
      transitionService: new FactoryTransitionService({ storage: workItems, rules }),
      storage: workItems,
      isAutoRunEnabled: async () => true,
      ownerId: 'worker-1',
    });

    const reviewRequested = (deliveryId: string) => ({
      event: 'pull_request',
      deliveryId,
      payload: {
        action: 'review_requested',
        installation: { id: 7 },
        repository: { id: 10, full_name: 'acme/repo' },
        sender: { login: 'maintainer' },
        requested_reviewer: { login: 'factory-app[bot]' },
        pull_request: {
          number: 17,
          title: 'PR 17',
          html_url: 'https://github.com/acme/repo/pull/17',
          created_at: '2030-01-01T00:00:00Z',
          state: 'open',
          merged: false,
          head: { ref: 'feature' },
          base: { ref: 'main' },
        },
      },
    });

    await expect(service.ingest(reviewRequested('delivery-rr-dispatch'))).resolves.toEqual({ status: 'committed' });
    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    // The card is back in Reviewing and the review onEnter rule queued a fresh pass.
    const [item] = await workItems.list({ orgId: 'org-1', factoryProjectId: project.id });
    expect(item).toMatchObject({ id: card.item.id, stages: ['review'] });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: card.item.id,
          decision: expect.objectContaining({ type: 'invokeSkill', skillName: 'factory-rereview', role: 'review' }),
        }),
      ]),
    );

    // Replaying the same delivery does not stack another pass.
    await expect(service.ingest(reviewRequested('delivery-rr-dispatch'))).resolves.toEqual({ status: 'replayed' });
    // A second re-request while the card is already Reviewing is a guarded no-op.
    await expect(service.ingest(reviewRequested('delivery-rr-again'))).resolves.toEqual({ status: 'committed' });
    await expect(service.ingest(pullRequestComment('delivery-rr-comment-again'))).resolves.toEqual({ status: 'committed' });
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions.filter(entry => entry.decision.type === 'transition')).toHaveLength(1);
    expect(decisions.filter(entry => entry.decision.type === 'invokeSkill')).toHaveLength(1);
  });

  it('re-reviews a PR when a push arrives after Reviewing finished and asks the dispatcher to cancel the in-flight pass', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    const card = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'PR 17',
        stages: ['done'],
        sessions: {},
        metadata: { authorTrusted: true },
      },
    });
    const rules = builtInFactoryRules();
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules,
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: { getSessionByResource: vi.fn(async () => undefined) } as never,
      transitionService: new FactoryTransitionService({ storage: workItems, rules }),
      storage: workItems,
      isAutoRunEnabled: async () => true,
      ownerId: 'worker-1',
    });

    await expect(service.ingest(pullRequest('synchronize', 'delivery-push-1'))).resolves.toEqual({
      status: 'committed',
    });
    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    const [item] = await workItems.list({ orgId: 'org-1', factoryProjectId: project.id });
    expect(item).toMatchObject({ id: card.item.id, stages: ['review'] });
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions.filter(entry => entry.decision.type === 'transition')).toHaveLength(1);
    // A completed pass has no active run to supersede. Its re-entry dispatches
    // factory-rereview without aborting the newly prepared session.
    const invocations = decisions.filter(entry => entry.decision.type === 'invokeSkill');
    expect(invocations).toHaveLength(1);
    expect(invocations[0]!.decision).toMatchObject({
      type: 'invokeSkill',
      skillName: 'factory-rereview',
      role: 'review',
    });
    expect(invocations[0]!.decision).not.toHaveProperty('cancelInFlight');

    // A follow-up push while the card is still Reviewing supersedes the pass it
    // just started, which is now reading code the push replaced. Re-entering
    // from `review` rather than `done` means there is no completed pass left to
    // reconcile against, so the fresh run is a plain review.
    await expect(service.ingest(pullRequest('synchronize', 'delivery-push-2'))).resolves.toEqual({
      status: 'committed',
    });
    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    const afterSecondPush = await workItems.listDeferredDecisions('org-1', project.id);
    const transitions = afterSecondPush.filter(entry => entry.decision.type === 'transition');
    expect(transitions).toHaveLength(2);
    // Without this the transition is inert: the card is already in the stage it
    // is being moved to, so the entry rule would never run.
    expect(transitions.at(-1)!.decision).toMatchObject({ stage: 'review', reenter: true });
    const reruns = afterSecondPush.filter(entry => entry.decision.type === 'invokeSkill');
    expect(reruns).toHaveLength(2);
    expect(reruns.at(-1)!.decision).toMatchObject({
      type: 'invokeSkill',
      skillName: 'factory-review',
      role: 'review',
      cancelInFlight: true,
    });
  });

  it('ignores push events on PRs whose card has not yet completed a review pass', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'PR 17',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(service.ingest(pullRequest('synchronize', 'delivery-push-intake'))).resolves.toEqual({
      status: 'committed',
    });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it.each(['maintain', 'triage', 'read', undefined])('fails closed for GitHub permission %s', async permission => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup(permission);
    const seen = vi.fn(() => undefined);
    const rules = defaultFactoryRules({ version: 'test-1', overrides: { github: { issueOpened: { onEvent: seen } } } });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules,
    });

    await service.ingest(issueOpened(`delivery-${permission ?? 'missing'}`));
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ actor: expect.objectContaining({ trusted: false }) }));
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('routes a changes-requested review back to the Work item that authored the pull request', async () => {
    // Reviews used to stop at the ingress: the webhook was accepted and
    // classified urgent, but no rule event existed, so the authoring agent was
    // never told and the work/review loop stayed open.
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    const work = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
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
    });
    await integrationStorage.subscriptions.create({
      orgId: 'org-1',
      targetKey: 'factory-pr-provenance:10:17',
      threadId: 'thread-1',
      status: 'active',
      data: { kind: 'factory-pr-provenance', factoryProjectId: project.id, workItemId: work.item.id },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest({
      event: 'pull_request_review',
      deliveryId: 'delivery-review-submitted',
      payload: {
        action: 'submitted',
        installation: { id: 7 },
        repository: { id: 10, full_name: 'acme/repo' },
        sender: { login: 'reviewer' },
        review: {
          id: 99,
          state: 'changes_requested',
          html_url: 'https://github.com/acme/repo/pull/17#pullrequestreview-99',
        },
        pull_request: {
          number: 17,
          title: 'PR 17',
          html_url: 'https://github.com/acme/repo/pull/17',
          state: 'open',
          merged: false,
          head: { ref: 'feature' },
          base: { ref: 'main' },
        },
      },
    });

    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: work.item.id,
          decision: expect.objectContaining({ type: 'sendMessage', role: 'work', priority: 'high' }),
        }),
      ]),
    );
  });

  it('routes a changes-requested review through the PR card to the work item that authored it', async () => {
    // Provenance is the happy path, but it is not always there: a PR opened
    // outside the tracked tool call records none, so the PR-number lookup wins
    // and returns the PR's own Review card. `addressReviewFeedback` refuses to
    // act on the review board, so the wake was dropped and the authoring agent
    // never heard about the feedback. The linked card names its author, so the
    // event has to be carried back across that link.
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    const work = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
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
    });
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github:10:pull-request:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        parentWorkItemId: work.item.id,
        title: 'PR 17',
        stages: ['review'],
        sessions: {},
        metadata: {},
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest({
      event: 'pull_request_review',
      deliveryId: 'delivery-review-through-pr-card',
      payload: {
        action: 'submitted',
        installation: { id: 7 },
        repository: { id: 10, full_name: 'acme/repo' },
        sender: { login: 'reviewer' },
        review: {
          id: 99,
          state: 'changes_requested',
          html_url: 'https://github.com/acme/repo/pull/17#pullrequestreview-99',
        },
        pull_request: {
          number: 17,
          title: 'PR 17',
          html_url: 'https://github.com/acme/repo/pull/17',
          state: 'open',
          merged: false,
          head: { ref: 'feature' },
          base: { ref: 'main' },
        },
      },
    });

    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: work.item.id,
          decision: expect.objectContaining({ type: 'sendMessage', role: 'work', priority: 'high' }),
        }),
      ]),
    );
  });

  it('ignores a changes-requested review on a pull request card with no authoring work item', async () => {
    // The link is what makes the hop safe. Without one there is no agent that
    // wrote this code, and waking the PR card's own review session would put
    // the reviewer in a loop against itself.
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github:10:pull-request:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'PR 17',
        stages: ['review'],
        sessions: {},
        metadata: {},
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest({
      event: 'pull_request_review',
      deliveryId: 'delivery-review-orphan-pr-card',
      payload: {
        action: 'submitted',
        installation: { id: 7 },
        repository: { id: 10, full_name: 'acme/repo' },
        sender: { login: 'reviewer' },
        review: {
          id: 99,
          state: 'changes_requested',
          html_url: 'https://github.com/acme/repo/pull/17#pullrequestreview-99',
        },
        pull_request: {
          number: 17,
          title: 'PR 17',
          html_url: 'https://github.com/acme/repo/pull/17',
          state: 'open',
          merged: false,
          head: { ref: 'feature' },
          base: { ref: 'main' },
        },
      },
    });

    expect(
      (await workItems.listDeferredDecisions('org-1', project.id)).filter(
        record => record.decision.type === 'sendMessage',
      ),
    ).toEqual([]);
  });

  it('delivers a changes-requested review into the authoring agent session', async () => {
    // The rule test above only proves a decision row of the right shape exists.
    // This one runs the dispatcher over that row so the leg is exercised all the
    // way to the message the authoring agent actually receives.
    const { github, sourceControl, integrationStorage, workItems, projects, project, projectRepository } =
      await setup('read');
    const rules = builtInFactoryRules();
    const transitionService = new FactoryTransitionService({ storage: workItems, rules });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules,
    });

    const notifications: Array<{ threadId: string; summary: string; priority: string }> = [];
    let threadId: string | undefined = 'thread-work';
    const session = {
      thread: {
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
      state: { get: vi.fn(() => ({ factoryProjectId: project.id })), set: vi.fn(async () => {}) },
      mode: { get: vi.fn(() => 'build') },
      model: { get: vi.fn(() => 'openai/gpt-5.6-sol') },
      identity: { getId: vi.fn(() => 'session-work-42'), getOwnerId: vi.fn(() => 'user-1') },
      permissions: { setForTool: vi.fn(async () => {}) },
      sendMessage: vi.fn(async () => {}),
      sendSignal: vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, action: 'wake' }) })),
      sendNotificationSignal: vi.fn(
        async (input: { summary: string; priority: string }) => (
          notifications.push({ threadId: threadId!, summary: input.summary, priority: input.priority }),
          {
            persisted: Promise.resolve(),
            accepted: Promise.resolve({ action: 'wake', output: { consumeStream: async () => {} } }),
          }
        ),
      ),
    };
    const controller = {
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
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      transitionService,
      storage: workItems,
      isAutoRunEnabled: async () => true,
      ownerId: 'worker-1',
    });

    await service.ingest({
      event: 'pull_request_review',
      deliveryId: 'delivery-review-dispatched',
      payload: {
        action: 'submitted',
        installation: { id: 7 },
        repository: { id: 10, full_name: 'acme/repo' },
        sender: { login: 'reviewer' },
        review: {
          id: 99,
          state: 'changes_requested',
          body: 'This needs a null check.',
          html_url: 'https://github.com/acme/repo/pull/17#pullrequestreview-99',
        },
        pull_request: {
          number: 17,
          title: 'PR 17',
          html_url: 'https://github.com/acme/repo/pull/17',
          state: 'open',
          merged: false,
          head: { ref: 'feature' },
          base: { ref: 'main' },
        },
      },
    });
    await dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));

    expect(notifications).toEqual([
      expect.objectContaining({
        threadId: 'thread-work',
        priority: 'high',
        summary: expect.stringContaining('https://github.com/acme/repo/pull/17'),
      }),
    ]);
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(
      decisions.filter(decision => decision.decision.type === 'sendMessage').map(decision => decision.status),
    ).toEqual(['succeeded']);
  });

  it('routes a comment on a pull request back to the Work item that authored it', async () => {
    // Comments on a PR arrive as `issue_comment` and used to be dropped at the
    // ingress, so review feedback left as a plain comment — the fallback the
    // review skill takes on Factory-authored PRs, where GitHub refuses a formal
    // verdict — never reached the author.
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    const work = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
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
    });
    await integrationStorage.subscriptions.create({
      orgId: 'org-1',
      targetKey: 'factory-pr-provenance:10:17',
      threadId: 'thread-1',
      status: 'active',
      data: { kind: 'factory-pr-provenance', factoryProjectId: project.id, workItemId: work.item.id },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest({
      event: 'issue_comment',
      deliveryId: 'delivery-pr-comment',
      payload: {
        action: 'created',
        installation: { id: 7 },
        repository: { id: 10, full_name: 'acme/repo' },
        sender: { login: 'reviewer' },
        comment: {
          id: 555,
          body: 'This needs a null check.',
          html_url: 'https://github.com/acme/repo/pull/17#issuecomment-555',
          user: { login: 'reviewer' },
        },
        issue: {
          number: 17,
          title: 'PR 17',
          html_url: 'https://github.com/acme/repo/pull/17',
          state: 'open',
          pull_request: { url: 'https://api.github.com/repos/acme/repo/pulls/17' },
        },
      },
    });

    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: work.item.id,
          decision: expect.objectContaining({ type: 'sendMessage', role: 'work', priority: 'high' }),
        }),
      ]),
    );
  });

  it('uses verified Factory provenance to link an opened Review card and remind Work on merge', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    const work = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
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
    });
    await integrationStorage.subscriptions.create({
      orgId: 'org-1',
      targetKey: 'factory-pr-provenance:10:17',
      threadId: 'thread-1',
      status: 'active',
      data: { kind: 'factory-pr-provenance', factoryProjectId: project.id, workItemId: work.item.id },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest(pullRequest('opened', 'delivery-open'));
    await service.ingest(pullRequest('closed', 'delivery-merge', true));
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: work.item.id,
          decision: expect.objectContaining({ type: 'upsertLinkedWorkItem' }),
        }),
        expect.objectContaining({
          workItemId: work.item.id,
          decision: expect.objectContaining({ type: 'sendMessage', role: 'work' }),
        }),
      ]),
    );
    expect(decisions.map(entry => entry.decision)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'transition' })]),
    );
  });

  it('ignores provenance recorded by a sibling Factory project in the same org', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    const work = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
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
    });
    await integrationStorage.subscriptions.create({
      orgId: 'org-1',
      targetKey: 'factory-pr-provenance:10:17',
      threadId: 'thread-1',
      status: 'active',
      data: { kind: 'factory-pr-provenance', factoryProjectId: 'sibling-project', workItemId: work.item.id },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest(pullRequest('opened', 'delivery-foreign-provenance'));

    // The PR still gets its Review card, but unbranded: another project's
    // provenance must neither bind this project's Work item nor mark the PR
    // Factory-authored (which would auto-start a review that executes it).
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toEqual([
      expect.objectContaining({
        decision: expect.objectContaining({
          type: 'upsertLinkedWorkItem',
          metadata: expect.objectContaining({ factoryAuthored: false, autoStartCandidate: false }),
        }),
      }),
    ]);
    expect(decisions[0]?.workItemId).not.toBe(work.item.id);
  });

  it('links an opened Review card to the work item whose session branch matches the PR head branch', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    const work = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
        title: 'Issue 42',
        stages: ['execute'],
        sessions: { work: { sessionId: 'session-issue-42', branch: 'feature', threadId: 'session-issue-42' } },
        metadata: {},
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest(pullRequest('opened', 'delivery-branch-link'));
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toEqual([
      expect.objectContaining({
        workItemId: work.item.id,
        decision: expect.objectContaining({
          type: 'upsertLinkedWorkItem',
          source: 'github-pr',
          metadata: expect.objectContaining({ headBranch: 'feature' }),
        }),
      }),
    ]);
  });

  it('moves the merged Review card to Done when the PR has no Factory provenance', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    const card = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        title: 'PR 17',
        stages: ['review'],
        sessions: {},
        metadata: {},
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(service.ingest(pullRequest('closed', 'delivery-merged-card', true))).resolves.toEqual({
      status: 'committed',
    });
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toEqual([
      expect.objectContaining({
        workItemId: card.item.id,
        decision: expect.objectContaining({ type: 'transition', board: 'review', stage: 'done' }),
      }),
    ]);
  });

  it('closes the merged Review card and wakes the work item it was opened from', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    const work = await createLinkedIssue(workItems, project.id);
    const card = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        parentWorkItemId: work.id,
        title: 'PR 17',
        stages: ['review'],
        sessions: {},
        metadata: {},
      },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await expect(service.ingest(pullRequest('closed', 'delivery-merged-both', true))).resolves.toEqual({
      status: 'committed',
    });
    const merged = await workItems.listDeferredDecisions('org-1', project.id);
    expect(merged).toHaveLength(2);
    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: card.item.id,
          decision: expect.objectContaining({ type: 'transition', board: 'review', stage: 'done' }),
        }),
        expect.objectContaining({
          workItemId: work.id,
          decision: expect.objectContaining({ type: 'sendMessage', role: 'work' }),
        }),
      ]),
    );

    // The fan-out rides the same delivery, so replaying it must stay inert for
    // both cards rather than sending the work item a second reminder.
    await expect(service.ingest(pullRequest('closed', 'delivery-merged-both', true))).resolves.toEqual({
      status: 'replayed',
    });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toHaveLength(2);
  });

  it('closes the Review card of a merged PR that provenance bound to its work item', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('read');
    const work = await createLinkedIssue(workItems, project.id);
    const card = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        parentWorkItemId: work.id,
        title: 'PR 17',
        stages: ['review'],
        sessions: {},
        metadata: {},
      },
    });
    await integrationStorage.subscriptions.create({
      orgId: 'org-1',
      targetKey: 'factory-pr-provenance:10:17',
      threadId: 'thread-1',
      status: 'active',
      data: { kind: 'factory-pr-provenance', factoryProjectId: project.id, workItemId: work.id },
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest(pullRequest('closed', 'delivery-merged-provenance', true));
    const merged = await workItems.listDeferredDecisions('org-1', project.id);
    expect(merged).toHaveLength(2);
    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: work.id,
          decision: expect.objectContaining({ type: 'sendMessage', role: 'work' }),
        }),
        expect.objectContaining({
          workItemId: card.item.id,
          decision: expect.objectContaining({ type: 'transition', board: 'review', stage: 'done' }),
        }),
      ]),
    );
  });

  it('evaluates the same delivery independently for every tenant project mapped to the repository', async () => {
    const { github, sourceControl, integrationStorage, workItems, projects, project } = await setup('write');
    const second = await projects.create({
      orgId: 'org-2',
      userId: 'user-2',
      input: { name: 'Project 2' },
    });
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-2',
      connectedByUserId: 'user-2',
      externalId: '7',
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-2',
      input: { installationId: installation.id, externalId: '10', slug: 'acme/repo', defaultBranch: 'main' },
    });
    const connection = await sourceControl.connections.create({
      orgId: 'org-2',
      factoryProjectId: second.id,
      installationId: installation.id,
      createdByUserId: 'user-2',
    });
    await sourceControl.projectRepositories.link({
      orgId: 'org-2',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-2',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace',
    });
    const service = new GithubRules({
      github,
      sourceControl,
      integrationStorage,
      projects,
      storage: workItems,
      rules: builtInFactoryRules(),
    });

    await service.ingest(issueOpened('multi-tenant'));
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toHaveLength(1);
    expect(await workItems.listDeferredDecisions('org-2', second.id)).toHaveLength(1);
  });
});

describe('createGithubPullRequestReconciler', () => {
  const repositoryTarget = { id: 10, fullName: 'acme/repo', installationId: 7 };

  function mergedState(number: number): ReconcilePullRequestState {
    return {
      title: `PR ${number}`,
      url: `https://github.com/acme/repo/pull/${number}`,
      state: 'closed',
      draft: false,
      merged: true,
      assignees: ['assignee'],
      requestedReviewers: ['reviewer'],
      labels: ['bug'],
      headBranch: 'feature',
      baseBranch: 'main',
      author: 'pr-author',
      createdAt: '2030-01-01T00:00:00Z',
      mergedBy: 'maintainer',
    };
  }

  async function createCard(
    context: Awaited<ReturnType<typeof setup>>,
    input: { number: number; url?: string | null; stages?: string[]; metadata?: Record<string, unknown> },
  ) {
    return context.workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: context.project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: `github-pr:${input.number}`,
          url: input.url === null ? undefined : (input.url ?? `https://github.com/acme/repo/pull/${input.number}`),
        },
        title: `PR ${input.number}`,
        stages: input.stages ?? ['review'],
        sessions: {},
        metadata: input.metadata ?? {},
      },
    });
  }

  function createReconciler(
    context: Awaited<ReturnType<typeof setup>>,
    fetchPullRequest: ReturnType<typeof vi.fn>,
    fetchIssue?: ReturnType<typeof vi.fn>,
  ) {
    return createGithubPullRequestReconciler(
      {
        github: context.github,
        sourceControl: context.sourceControl,
        integrationStorage: context.integrationStorage,
        projects: context.projects,
        storage: context.workItems,
        rules: builtInFactoryRules(),
      },
      fetchPullRequest as never,
      fetchIssue as never,
    );
  }

  async function createIssueCard(
    context: Awaited<ReturnType<typeof setup>>,
    input: { number: number; stages?: string[]; url?: string | null; metadata?: Record<string, unknown> },
  ) {
    return context.workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: context.project.id,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: `github-issue:${input.number}`,
          url: input.url === null ? undefined : (input.url ?? `https://github.com/acme/repo/issues/${input.number}`),
        },
        title: `Issue ${input.number}`,
        stages: input.stages ?? ['planning'],
        sessions: {},
        metadata: input.metadata ?? {},
      },
    });
  }

  function closedIssueState(number: number, stateReason?: string): ReconcileIssueState {
    return {
      title: `Issue ${number}`,
      url: `https://github.com/acme/repo/issues/${number}`,
      state: 'closed',
      ...(stateReason ? { stateReason } : {}),
      assignees: [],
      author: 'maintainer',
    };
  }

  it('replays a missed merge through the ingress exactly once', async () => {
    const context = await setup('read');
    const card = await createCard(context, { number: 17 });
    const fetchPullRequest = vi.fn(async () => mergedState(17));
    const reconcile = createReconciler(context, fetchPullRequest);

    await expect(reconcile([repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 1,
      merged: 1,
      closed: 0,
      failed: 0,
      errors: [],
    });
    expect(fetchPullRequest).toHaveBeenCalledWith({ installationId: 7, repository: 'acme/repo', number: 17 });
    const decisions = await context.workItems.listDeferredDecisions('org-1', context.project.id);
    expect(decisions).toEqual([
      expect.objectContaining({
        workItemId: card.item.id,
        decision: expect.objectContaining({ type: 'transition', board: 'review', stage: 'done' }),
      }),
    ]);

    // A later sweep re-checks live state but the ingress replays: no
    // duplicate decisions are committed for the same merge.
    await expect(reconcile([repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 1,
      merged: 1,
      closed: 0,
      failed: 0,
      errors: [],
    });
    expect(await context.workItems.listDeferredDecisions('org-1', context.project.id)).toHaveLength(1);
  });

  it('only checks open cards and commits nothing for unmerged pull requests', async () => {
    const context = await setup('read');
    await createCard(context, {
      number: 17,
      stages: ['done'],
      metadata: {
        author: 'pr-author',
        state: 'closed',
        draft: false,
        merged: true,
        assignees: [],
        requestedReviewers: [],
        labels: [],
        [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'merged',
      },
    });
    await createCard(context, { number: 18 });
    const fetchPullRequest = vi.fn(async () => ({ ...mergedState(18), state: 'open' as const, merged: false }));
    const reconcile = createReconciler(context, fetchPullRequest);

    await expect(reconcile([repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 1,
      merged: 0,
      closed: 0,
      failed: 0,
      errors: [],
    });
    expect(fetchPullRequest).toHaveBeenCalledTimes(1);
    expect(fetchPullRequest).toHaveBeenCalledWith({ installationId: 7, repository: 'acme/repo', number: 18 });
    expect(await context.workItems.listDeferredDecisions('org-1', context.project.id)).toHaveLength(0);
  });

  it('picks up a merge on a card an approving review already moved to done', async () => {
    const context = await setup('read');
    const card = await createCard(context, {
      number: 17,
      stages: ['done'],
      metadata: {
        author: 'pr-author',
        state: 'open',
        draft: false,
        merged: false,
        assignees: [],
        requestedReviewers: [],
        labels: [],
      },
    });
    const now = new Date('2030-01-01T00:00:00.000Z');
    await context.workItems.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: context.project.id,
      workItemId: card.item.id,
      ingress: { identity: 'settled-proposal', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: card.item.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'invokeSkill',
          role: 'review',
          skillName: 'factory-review',
          idempotencyKey: 'settled-proposal-review',
        },
      ],
      causalChain: [],
      now,
    });
    const [claimed] = await context.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    if (!claimed) throw new Error('Expected a proposal');
    await context.workItems.proposeDeferredDecision(
      {
        id: claimed.id,
        orgId: claimed.orgId,
        factoryProjectId: claimed.factoryProjectId,
        ownerId: 'worker-1',
      },
      now,
    );
    const fetchPullRequest = vi.fn(async () => ({ ...mergedState(17), state: 'open' as const, merged: false }));
    const reconcile = createReconciler(context, fetchPullRequest);

    await reconcile([repositoryTarget]);
    fetchPullRequest.mockImplementation(async () => mergedState(17));
    await reconcile([repositoryTarget]);

    expect(fetchPullRequest).toHaveBeenCalledTimes(2);
    await reconcile([repositoryTarget]);
    expect(fetchPullRequest).toHaveBeenCalledTimes(2);
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { state: 'closed', merged: true },
    });
    expect(
      (await context.workItems.listDeferredDecisions('org-1', context.project.id)).find(
        decision => decision.id === claimed.id,
      )?.status,
    ).toBe('superseded');
  });

  it('settles failed attention when closed pull request metadata already matches', async () => {
    const context = await setup('read');
    const card = await createCard(context, {
      number: 17,
      stages: ['done'],
      metadata: {
        author: 'pr-author',
        state: 'closed',
        draft: false,
        merged: true,
        assignees: ['assignee'],
        requestedReviewers: ['reviewer'],
        labels: ['bug'],
      },
    });
    const now = new Date('2030-01-01T00:00:00.000Z');
    await context.workItems.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: context.project.id,
      workItemId: card.item.id,
      ingress: { identity: 'failed-before-settlement', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: card.item.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'sendMessage',
          role: 'review',
          message: 'Notify the review session.',
          idempotencyKey: 'failed-before-settlement',
        },
      ],
      causalChain: [],
      now,
    });
    const [claimed] = await context.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    if (!claimed) throw new Error('Expected a deferred decision');
    await context.workItems.failDeferredDecision({
      id: claimed.id,
      orgId: claimed.orgId,
      factoryProjectId: claimed.factoryProjectId,
      ownerId: 'worker-1',
      now,
      availableAt: now,
      lastError: 'No active review session.',
      failureCode: 'session_unavailable',
      terminal: true,
    });
    const fetchPullRequest = vi.fn(async () => mergedState(17));
    const reconcile = createReconciler(context, fetchPullRequest);

    await reconcile([repositoryTarget]);
    await reconcile([repositoryTarget]);

    expect(fetchPullRequest).toHaveBeenCalledTimes(1);
    expect(
      (await context.workItems.listDeferredDecisions('org-1', context.project.id)).find(
        decision => decision.id === claimed.id,
      )?.status,
    ).toBe('superseded');
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'merged' },
    });
  });

  it('keeps a failed close transition actionable until the card reaches a terminal stage', async () => {
    const context = await setup('read');
    const card = await createCard(context, { number: 17 });
    const rules = new GithubRules({
      github: context.github,
      sourceControl: context.sourceControl,
      integrationStorage: context.integrationStorage,
      projects: context.projects,
      storage: context.workItems,
      rules: builtInFactoryRules(),
    });
    const now = new Date('2030-01-01T00:00:00.000Z');
    await rules.ingest(reconciledClosedEvent(repositoryTarget, 17, mergedState(17)));
    const [claimed] = await context.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    if (!claimed) throw new Error('Expected a deferred decision');
    await context.workItems.failDeferredDecision({
      id: claimed.id,
      orgId: claimed.orgId,
      factoryProjectId: claimed.factoryProjectId,
      ownerId: 'worker-1',
      now,
      availableAt: now,
      lastError: 'Transition delivery failed.',
      failureCode: 'unknown',
      terminal: true,
    });

    await createReconciler(
      context,
      vi.fn(async () => mergedState(17)),
    )([repositoryTarget]);

    expect(
      (await context.workItems.listDeferredDecisions('org-1', context.project.id)).find(
        decision => decision.id === claimed.id,
      )?.status,
    ).toBe('failed');
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      stages: ['review'],
    });
  });

  it('backfills status once for terminal pull request cards created before status metadata existed', async () => {
    const context = await setup('read');
    const card = await createCard(context, { number: 17, stages: ['done'] });
    const fetchPullRequest = vi.fn(async () => ({ ...mergedState(17), merged: false, mergedBy: undefined }));
    const reconcile = createReconciler(context, fetchPullRequest);

    await reconcile([repositoryTarget]);
    await reconcile([repositoryTarget]);

    expect(fetchPullRequest).toHaveBeenCalledTimes(1);
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: {
        state: 'closed',
        draft: false,
        merged: false,
        assignees: ['assignee'],
        requestedReviewers: ['reviewer'],
        labels: ['bug'],
      },
    });
  });

  it('backfills authors once for terminal pull request cards created before author metadata existed', async () => {
    const context = await setup('read');
    const card = await createCard(context, {
      number: 17,
      stages: ['done'],
      metadata: { state: 'closed', draft: false, merged: true, assignees: [], requestedReviewers: [], labels: [] },
    });
    const fetchPullRequest = vi.fn(async () => mergedState(17));
    const reconcile = createReconciler(context, fetchPullRequest);

    await reconcile([repositoryTarget]);
    await reconcile([repositoryTarget]);

    expect(fetchPullRequest).toHaveBeenCalledTimes(1);
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: {
        author: 'pr-author',
        state: 'closed',
        draft: false,
        merged: true,
        assignees: ['assignee'],
        requestedReviewers: ['reviewer'],
      },
    });
  });

  it('silently reconciles status, authors, and relevance metadata on open pull request cards', async () => {
    const context = await setup('read');
    const missing = await createCard(context, { number: 18, metadata: { repository: 'acme/repo' } });
    const stale = await createCard(context, {
      number: 19,
      metadata: {
        author: 'old-author',
        state: 'open',
        draft: false,
        merged: false,
        assignees: ['old-assignee'],
        requestedReviewers: ['old-reviewer'],
        repository: 'acme/repo',
      },
    });
    const fetchPullRequest = vi.fn(async (input: { number: number }) => ({
      ...mergedState(input.number),
      state: 'open' as const,
      draft: input.number === 19,
      merged: false,
      author: `author-${input.number}`,
      assignees: [`assignee-${input.number}`],
      requestedReviewers: [`reviewer-${input.number}`],
    }));

    await expect(createReconciler(context, fetchPullRequest)([repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 2,
      merged: 0,
      closed: 0,
      failed: 0,
      errors: [],
    });

    await expect(context.workItems.get({ orgId: 'org-1', id: missing.item.id })).resolves.toMatchObject({
      metadata: {
        author: 'author-18',
        state: 'open',
        draft: false,
        merged: false,
        assignees: ['assignee-18'],
        requestedReviewers: ['reviewer-18'],
        repository: 'acme/repo',
      },
    });
    await expect(context.workItems.get({ orgId: 'org-1', id: stale.item.id })).resolves.toMatchObject({
      metadata: {
        author: 'author-19',
        state: 'open',
        draft: true,
        merged: false,
        assignees: ['assignee-19'],
        requestedReviewers: ['reviewer-19'],
        repository: 'acme/repo',
      },
    });
    expect(await context.workItems.listDeferredDecisions('org-1', context.project.id)).toHaveLength(0);
  });

  it('backfills author trust on open cards created before the stamp existed', async () => {
    const context = await setup('write');
    const card = await createCard(context, {
      number: 18,
      metadata: { author: 'pr-author', state: 'open', draft: false, merged: false },
    });
    const fetchPullRequest = vi.fn(async (input: { number: number }) => ({
      ...mergedState(input.number),
      state: 'open' as const,
      draft: false,
      merged: false,
      mergedBy: undefined,
    }));

    await createReconciler(context, fetchPullRequest)([repositoryTarget]);

    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { authorTrusted: true },
    });
  });

  it('downgrades the stamp once a trusted author loses write access', async () => {
    const context = await setup('write');
    const card = await createCard(context, {
      number: 18,
      metadata: { author: 'pr-author', state: 'open', draft: false, merged: false },
    });
    const fetchPullRequest = vi.fn(async (input: { number: number }) => ({
      ...mergedState(input.number),
      state: 'open' as const,
      draft: false,
      merged: false,
      mergedBy: undefined,
    }));
    const reconcile = createReconciler(context, fetchPullRequest);

    await reconcile([repositoryTarget]);
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { authorTrusted: true },
    });

    vi.mocked(context.github.getRepositoryCollaboratorPermission).mockResolvedValue(undefined);
    await reconcile([repositoryTarget]);
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { authorTrusted: false },
    });

    vi.mocked(context.github.getRepositoryCollaboratorPermission).mockResolvedValue('admin');
    await reconcile([repositoryTarget]);
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { authorTrusted: true },
    });
  });

  it('stamps an untrusted author as untrusted rather than leaving the card unstamped', async () => {
    const context = await setup(undefined);
    const card = await createCard(context, {
      number: 18,
      metadata: { author: 'pr-author', state: 'open', draft: false, merged: false },
    });
    const fetchPullRequest = vi.fn(async (input: { number: number }) => ({
      ...mergedState(input.number),
      state: 'open' as const,
      draft: false,
      merged: false,
      mergedBy: undefined,
    }));

    await createReconciler(context, fetchPullRequest)([repositoryTarget]);

    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { authorTrusted: false },
    });
  });

  it('stamps author trust on the settled patch of a terminal card the sweep closes out', async () => {
    const context = await setup('write');
    const card = await createCard(context, {
      number: 17,
      stages: ['done'],
      metadata: { author: 'pr-author', state: 'open', draft: false, merged: false },
    });
    const fetchPullRequest = vi.fn(async () => mergedState(17));

    await createReconciler(context, fetchPullRequest)([repositoryTarget]);

    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { authorTrusted: true, merged: true },
    });
  });

  it('answers for a settled card the sweep no longer visits, without fetching its pull request', async () => {
    const context = await setup('write');
    const card = await createCard(context, {
      number: 19,
      stages: ['done'],
      metadata: {
        author: 'pr-author',
        state: 'closed',
        merged: true,
        [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'merged',
      },
    });
    const fetchPullRequest = vi.fn(async () => mergedState(19));

    await createReconciler(context, fetchPullRequest)([repositoryTarget]);

    expect(fetchPullRequest).not.toHaveBeenCalled();
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { authorTrusted: true },
    });
  });

  it.each([
    { attribution: 'the intake-stamped repository', metadata: { githubRepositoryId: 10 }, answered: true },
    { attribution: 'nothing but its number', metadata: {}, answered: false },
  ])('answers for a URL-less settled card that names $attribution', async ({ metadata, answered }) => {
    const context = await setup('write');
    const card = await createCard(context, {
      number: 31,
      url: null,
      stages: ['done'],
      metadata: {
        ...metadata,
        author: 'pr-author',
        state: 'closed',
        merged: true,
        [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'merged',
      },
    });

    await createReconciler(context, vi.fn(async () => mergedState(31)))([repositoryTarget]);

    const stamped = await context.workItems.get({ orgId: 'org-1', id: card.item.id });
    expect(stamped?.metadata?.authorTrusted).toBe(answered ? true : undefined);
  });

  it.each([
    { merged: true, expected: 'merged' },
    { merged: false, expected: 'closed' },
  ])('retires the thread subscription to $expected', async ({ merged, expected }) => {
    const context = await setup('read');
    await createCard(context, { number: 23 });
    const subscription = await context.subscriptionStorage.subscriptions.create({
      orgId: 'org-1',
      targetKey: changeRequestTargetKey({
        installationExternalId: '7',
        repositoryExternalId: '10',
        changeRequestId: '23',
      }),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      status: 'open',
      data: {},
    });
    const fetchPullRequest = vi.fn(async () => ({ ...mergedState(23), merged, mergedBy: undefined }));

    await createReconciler(context, fetchPullRequest)([repositoryTarget]);

    const [row] = await context.subscriptionStorage.subscriptions.listByTarget(subscription.targetKey);
    expect(row?.status).toBe(expected);
  });

  it('never checks a card whose URL points at a different repository', async () => {
    const context = await setup('read');
    await createCard(context, { number: 19, url: 'https://github.com/other/repo/pull/19' });
    const fetchPullRequest = vi.fn(async () => mergedState(19));
    const reconcile = createReconciler(context, fetchPullRequest);

    await expect(reconcile([repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 0,
      merged: 0,
      closed: 0,
      failed: 0,
      errors: [],
    });
    expect(fetchPullRequest).not.toHaveBeenCalled();
  });

  it('replays a close-without-merge and cancels the review card', async () => {
    const context = await setup('read');
    const card = await createCard(context, { number: 21 });
    const fetchPullRequest = vi.fn(async () => ({ ...mergedState(21), merged: false, mergedBy: undefined }));
    const reconcile = createReconciler(context, fetchPullRequest);

    await expect(reconcile([repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 1,
      merged: 0,
      closed: 1,
      failed: 0,
      errors: [],
    });
    const decisions = await context.workItems.listDeferredDecisions('org-1', context.project.id);
    expect(decisions).toEqual([
      expect.objectContaining({
        workItemId: card.item.id,
        decision: expect.objectContaining({ type: 'transition', board: 'review', stage: 'canceled' }),
      }),
    ]);

    // A second sweep replays through the ingress dedupe without new decisions.
    await reconcile([repositoryTarget]);
    expect(await context.workItems.listDeferredDecisions('org-1', context.project.id)).toHaveLength(1);
  });

  it('continues closed reconciliation when terminal decision cleanup fails', async () => {
    const context = await setup('read');
    const card = await createCard(context, { number: 17, stages: ['done'] });
    const cleanup = vi
      .spyOn(context.workItems, 'supersedeDecisionsForWorkItem')
      .mockRejectedValueOnce(new Error('Decision cleanup failed'));
    const reconcile = createReconciler(
      context,
      vi.fn(async () => mergedState(17)),
    );

    await expect(reconcile([repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 1,
      merged: 1,
      closed: 0,
      failed: 1,
      errors: [{ repository: 'acme/repo', pullRequestNumber: 17, error: 'Decision cleanup failed' }],
    });
    expect(await context.workItems.listDeferredDecisions('org-1', context.project.id)).toEqual([
      expect.objectContaining({
        workItemId: card.item.id,
        decision: expect.objectContaining({ type: 'transition', board: 'review', stage: 'done' }),
      }),
    ]);
    await expect(reconcile([repositoryTarget])).resolves.toMatchObject({ merged: 1, failed: 0 });
    expect(cleanup).toHaveBeenCalledTimes(2);
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'merged' },
    });
  });

  it('keeps sweeping the remaining PRs when one state fetch fails and reports the failure', async () => {
    const context = await setup('read');
    await createCard(context, { number: 17 });
    await createCard(context, { number: 18 });
    const fetchPullRequest = vi.fn(async (input: { number: number }) => {
      if (input.number === 17) throw new Error('Platform API request failed: 500 Internal Server Error');
      return mergedState(18);
    });
    const reconcile = createReconciler(context, fetchPullRequest);

    await expect(reconcile([repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 1,
      merged: 1,
      closed: 0,
      failed: 1,
      errors: [
        {
          repository: 'acme/repo',
          pullRequestNumber: 17,
          error: 'Platform API request failed: 500 Internal Server Error',
        },
      ],
    });
    // The healthy PR still got reconciled to Done.
    const decisions = await context.workItems.listDeferredDecisions('org-1', context.project.id);
    expect(decisions).toEqual([
      expect.objectContaining({
        decision: expect.objectContaining({ type: 'transition', board: 'review', stage: 'done' }),
      }),
    ]);
  });

  it('only sweeps repositories linked to a factory project', async () => {
    const context = await setup('read');
    await createCard(context, { number: 17 });
    const fetchPullRequest = vi.fn(async () => mergedState(17));
    const reconcile = createReconciler(context, fetchPullRequest);

    // The installation exposes many repositories, but only acme/repo is
    // linked to a factory project — the others must not be probed at all.
    const unconfigured = [
      { id: 11, fullName: 'acme/other', installationId: 7 },
      { id: 12, fullName: 'acme/archive', installationId: 7 },
    ];
    await expect(reconcile(unconfigured)).resolves.toEqual({
      repositories: 0,
      checked: 0,
      merged: 0,
      closed: 0,
      failed: 0,
      errors: [],
    });
    expect(fetchPullRequest).not.toHaveBeenCalled();

    await expect(reconcile([...unconfigured, repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 1,
      merged: 1,
      closed: 0,
      failed: 0,
      errors: [],
    });
    expect(fetchPullRequest).toHaveBeenCalledTimes(1);
    expect(fetchPullRequest).toHaveBeenCalledWith({ installationId: 7, repository: 'acme/repo', number: 17 });
  });

  // TODO: Rewrite issue close tests for dedicated GithubIssueReconciler
  it.skip('replays a missed issue close and moves the work card to done exactly once', async () => {
    const context = await setup('read');
    const card = await createIssueCard(context, { number: 42 });
    const fetchPullRequest = vi.fn(async () => undefined);
    const fetchIssue = vi.fn(async () => closedIssueState(42, 'completed'));
    const reconcile = createReconciler(context, fetchPullRequest, fetchIssue);

    await expect(reconcile([repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 0,
      merged: 0,
      closed: 0,
      issuesChecked: 1,
      issuesClosed: 1,
      failed: 0,
      errors: [],
    });
    expect(fetchIssue).toHaveBeenCalledWith({ installationId: 7, repository: 'acme/repo', number: 42 });
    const decisions = await context.workItems.listDeferredDecisions('org-1', context.project.id);
    expect(decisions).toEqual([
      expect.objectContaining({
        workItemId: card.item.id,
        decision: expect.objectContaining({ type: 'transition', board: 'work', stage: 'done' }),
      }),
    ]);

    // The ingress dedupe makes a second sweep replay without new decisions.
    await reconcile([repositoryTarget]);
    expect(await context.workItems.listDeferredDecisions('org-1', context.project.id)).toHaveLength(1);
  });

  it.skip('cancels the work card when the issue was closed as not planned', async () => {
    const context = await setup('read');
    const card = await createIssueCard(context, { number: 42 });
    const fetchIssue = vi.fn(async () => closedIssueState(42, 'not_planned'));
    const reconcile = createReconciler(
      context,
      vi.fn(async () => undefined),
      fetchIssue,
    );

    await reconcile([repositoryTarget]);

    const decisions = await context.workItems.listDeferredDecisions('org-1', context.project.id);
    expect(decisions).toEqual([
      expect.objectContaining({
        workItemId: card.item.id,
        decision: expect.objectContaining({ type: 'transition', board: 'work', stage: 'canceled' }),
      }),
    ]);
  });

  // TODO: Rewrite for dedicated GithubIssueReconciler
  it.skip('only trusts URL-less canonical issue cards whose stamped repository matches', async () => {
    const context = await setup('read');
    // Card intaken from this repository: URL lost, but repository id stamped.
    const ours = await createIssueCard(context, { number: 42, url: null, metadata: { githubRepositoryId: 10 } });
    // Same number in another linked repository: must never be swept here.
    await createIssueCard(context, { number: 43, url: null, metadata: { githubRepositoryId: 999 } });
    // No repository signal at all: ambiguous, so the sweep must not guess.
    await createIssueCard(context, { number: 44, url: null });
    const fetchIssue = vi.fn(async () => closedIssueState(42, 'completed'));
    const reconcile = createReconciler(
      context,
      vi.fn(async () => undefined),
      fetchIssue,
    );

    await expect(reconcile([repositoryTarget])).resolves.toMatchObject({ issuesChecked: 1, issuesClosed: 1 });
    expect(fetchIssue).toHaveBeenCalledTimes(1);
    expect(fetchIssue).toHaveBeenCalledWith({ installationId: 7, repository: 'acme/repo', number: 42 });
    const decisions = await context.workItems.listDeferredDecisions('org-1', context.project.id);
    expect(decisions).toEqual([
      expect.objectContaining({
        workItemId: ours.item.id,
        decision: expect.objectContaining({ type: 'transition', board: 'work', stage: 'done' }),
      }),
    ]);
  });

  it.skip('sweeps cards whose URL predates a repository rename via the stamped repository id', async () => {
    const context = await setup('read');
    // Renamed repository: the card URL still carries the old owner/name, but
    // the intake-stamped repository id is stable and confirms ownership.
    const renamed = await createIssueCard(context, {
      number: 42,
      url: 'https://github.com/acme/old-name/issues/42',
      metadata: { githubRepositoryId: 10 },
    });
    // Genuinely foreign card: URL and stamped id both point elsewhere.
    await createIssueCard(context, {
      number: 43,
      url: 'https://github.com/acme/other/issues/43',
      metadata: { githubRepositoryId: 999 },
    });
    const fetchIssue = vi.fn(async () => closedIssueState(42, 'completed'));
    const reconcile = createReconciler(
      context,
      vi.fn(async () => undefined),
      fetchIssue,
    );

    await expect(reconcile([repositoryTarget])).resolves.toMatchObject({ issuesChecked: 1, issuesClosed: 1 });
    expect(fetchIssue).toHaveBeenCalledTimes(1);
    expect(fetchIssue).toHaveBeenCalledWith({ installationId: 7, repository: 'acme/repo', number: 42 });
    const decisions = await context.workItems.listDeferredDecisions('org-1', context.project.id);
    expect(decisions).toEqual([
      expect.objectContaining({
        workItemId: renamed.item.id,
        decision: expect.objectContaining({ type: 'transition', board: 'work', stage: 'done' }),
      }),
    ]);
  });

  it.skip('skips terminal issue cards and commits nothing for issues still open', async () => {
    const context = await setup('read');
    await createIssueCard(context, { number: 41, stages: ['done'] });
    await createIssueCard(context, { number: 42 });
    const fetchIssue = vi.fn(async () => ({ ...closedIssueState(42), state: 'open' as const }));
    const reconcile = createReconciler(
      context,
      vi.fn(async () => undefined),
      fetchIssue,
    );

    await expect(reconcile([repositoryTarget])).resolves.toEqual({
      repositories: 1,
      checked: 0,
      merged: 0,
      closed: 0,
      issuesChecked: 1,
      failed: 0,
      errors: [],
    });
    expect(fetchIssue).toHaveBeenCalledTimes(1);
    expect(fetchIssue).toHaveBeenCalledWith({ installationId: 7, repository: 'acme/repo', number: 42 });
    expect(await context.workItems.listDeferredDecisions('org-1', context.project.id)).toHaveLength(0);
  });

  it.skip('never checks issue cards without an issue fetcher and reports issue fetch failures', async () => {
    const context = await setup('read');
    await createIssueCard(context, { number: 42 });
    const fetchIssue = vi.fn(async () => {
      throw new Error('Platform API request failed: 500 Internal Server Error');
    });

    // No fetcher wired: issue cards are ignored entirely.
    await expect(
      createReconciler(
        context,
        vi.fn(async () => undefined),
      )([repositoryTarget]),
    ).resolves.toMatchObject({
      failed: 0,
    });

    // Wired but failing: the sweep records the failure with issue context.
    await expect(
      createReconciler(
        context,
        vi.fn(async () => undefined),
        fetchIssue,
      )([repositoryTarget]),
    ).resolves.toMatchObject({
      failed: 1,
      errors: [
        {
          repository: 'acme/repo',
          issueNumber: 42,
          error: 'Platform API request failed: 500 Internal Server Error',
        },
      ],
    });
  });
});
