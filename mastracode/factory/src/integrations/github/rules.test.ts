import { describe, expect, it, vi } from 'vitest';
import { builtInFactoryRules, defaultFactoryRules } from '../../rules/defaults.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { FactoryStartCoordinator } from '../../rules/start-coordinator.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { GithubIntegration } from './integration.js';
import { createGithubPullRequestReconciler, GithubRules } from './rules.js';
import type { ReconcilePullRequestState } from './rules.js';
import { changeRequestTargetKey } from './subscriptions.js';

async function setup(permission: string | undefined) {
  const seeded = await createFactoryStorageForTests();
  const workItems = seeded.workItems;
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const integrationStorage = seeded.integrations.forIntegration<
    Record<string, unknown>,
    Record<string, unknown>,
    { kind: 'factory-pr-provenance'; workItemId: string }
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
  event: 'opened' | 'closed',
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
        issueComment('created', 'delivery-human-marker', { body: '<!-- mastra-factory-triage -->\nNew investigation lead' }),
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
        state: { set: vi.fn(async () => {}) },
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
      data: { kind: 'factory-pr-provenance', workItemId: work.item.id },
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

  it('dispatches a re-review transition back into Reviewing and queues a fresh factory-review pass', async () => {
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
        metadata: {},
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
          decision: expect.objectContaining({ type: 'invokeSkill', skillName: 'factory-review', role: 'review' }),
        }),
      ]),
    );

    // Replaying the same delivery does not stack another pass.
    await expect(service.ingest(reviewRequested('delivery-rr-dispatch'))).resolves.toEqual({ status: 'replayed' });
    // A second re-request while the card is already Reviewing is a guarded no-op.
    await expect(service.ingest(reviewRequested('delivery-rr-again'))).resolves.toEqual({ status: 'committed' });
    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions.filter(entry => entry.decision.type === 'transition')).toHaveLength(1);
    expect(decisions.filter(entry => entry.decision.type === 'invokeSkill')).toHaveLength(1);
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
      data: { kind: 'factory-pr-provenance', workItemId: work.item.id },
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

  function createReconciler(context: Awaited<ReturnType<typeof setup>>, fetchPullRequest: ReturnType<typeof vi.fn>) {
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
    );
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
      metadata: { author: 'pr-author', state: 'closed', draft: false, merged: true },
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

  it('backfills status once for terminal pull request cards created before status metadata existed', async () => {
    const context = await setup('read');
    const card = await createCard(context, { number: 17, stages: ['done'] });
    const fetchPullRequest = vi.fn(async () => ({
      ...mergedState(17),
      state: 'open' as const,
      draft: true,
      merged: false,
    }));
    const reconcile = createReconciler(context, fetchPullRequest);

    await reconcile([repositoryTarget]);
    await reconcile([repositoryTarget]);

    expect(fetchPullRequest).toHaveBeenCalledTimes(1);
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { state: 'open', draft: true, merged: false },
    });
  });

  it('backfills authors once for terminal pull request cards created before author metadata existed', async () => {
    const context = await setup('read');
    const card = await createCard(context, {
      number: 17,
      stages: ['done'],
      metadata: { state: 'closed', draft: false, merged: true },
    });
    const fetchPullRequest = vi.fn(async () => mergedState(17));
    const reconcile = createReconciler(context, fetchPullRequest);

    await reconcile([repositoryTarget]);
    await reconcile([repositoryTarget]);

    expect(fetchPullRequest).toHaveBeenCalledTimes(1);
    await expect(context.workItems.get({ orgId: 'org-1', id: card.item.id })).resolves.toMatchObject({
      metadata: { author: 'pr-author', state: 'closed', draft: false, merged: true },
    });
  });

  it('silently reconciles status and authors on open pull request cards', async () => {
    const context = await setup('read');
    const missing = await createCard(context, { number: 18, metadata: { repository: 'acme/repo' } });
    const stale = await createCard(context, {
      number: 19,
      metadata: { author: 'old-author', state: 'open', draft: false, merged: false, repository: 'acme/repo' },
    });
    const fetchPullRequest = vi.fn(async (input: { number: number }) => ({
      ...mergedState(input.number),
      state: 'open' as const,
      draft: input.number === 19,
      merged: false,
      author: `author-${input.number}`,
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
        repository: 'acme/repo',
      },
    });
    await expect(context.workItems.get({ orgId: 'org-1', id: stale.item.id })).resolves.toMatchObject({
      metadata: {
        author: 'author-19',
        state: 'open',
        draft: true,
        merged: false,
        repository: 'acme/repo',
      },
    });
    expect(await context.workItems.listDeferredDecisions('org-1', context.project.id)).toHaveLength(0);
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
});
