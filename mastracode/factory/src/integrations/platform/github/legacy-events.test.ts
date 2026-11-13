import type { TopicEvent } from '@mastra/connect';
import { describe, expect, it, vi } from 'vitest';

import type { dispatchGithubWebhook, GithubWebhookDispatchIntegration } from '../../github/webhook.js';
import type { GithubEventDeliveryConfig } from './events.js';
import { legacyGithubTopicSubscription, parseLegacyGithubTopicEvent } from './legacy-events.js';
import { LinkedGithubRepositories } from './linked-repositories.js';
import { PlatformGithubModes } from './mode.js';
import type { PlatformGithubModeRecord, PlatformGithubModeStorage } from './mode.js';

type Link = { installationId: number; repositoryId: number; orgId: string };

function modeStorage(records: Record<string, PlatformGithubModeRecord> = {}) {
  const rows = new Map<string, unknown>(
    Object.entries(records).map(([orgId, record]) => [`${orgId}|__platform_github_mode__`, record]),
  );
  return {
    integrationId: 'github',
    settings: {
      get: async (orgId: string, userId: string) => structuredClone(rows.get(`${orgId}|${userId}`) ?? null),
      save: async (orgId: string, userId: string, value: unknown) => void rows.set(`${orgId}|${userId}`, value),
    },
  } as unknown as PlatformGithubModeStorage;
}

function linkedRepositories(links: Link[]) {
  const source = {
    listConfiguredExternalKeys: vi.fn(async () =>
      links.map(link => ({
        installationExternalId: String(link.installationId),
        repositoryExternalId: String(link.repositoryId),
      })),
    ),
    listByExternalRepository: vi.fn(async (args: { installationExternalId: string; repositoryExternalId: string }) =>
      links
        .filter(
          link =>
            String(link.installationId) === args.installationExternalId &&
            String(link.repositoryId) === args.repositoryExternalId,
        )
        .map(link => ({ orgId: link.orgId, factoryProjectId: 'proj-1' }) as never),
    ),
  };
  return { repositories: new LinkedGithubRepositories(() => source), source };
}

function createGithub(overrides: Partial<GithubWebhookDispatchIntegration> = {}): GithubWebhookDispatchIntegration {
  return {
    integrationStorage: {} as never,
    sourceControlStorage: {
      sessions: { getBySessionId: async () => ({ userId: 'user-1', orgId: 'org-1' }) },
    },
    getRepositoryCollaboratorPermission: vi.fn<GithubWebhookDispatchIntegration['getRepositoryCollaboratorPermission']>(
      async () => 'write',
    ),
    ...overrides,
  } as GithubWebhookDispatchIntegration;
}

function logger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

let nextId = 0;
function topicEvent(
  kind: string,
  payload: Record<string, unknown>,
  options: { timestamp?: number; deliveryId?: string; rawPayload?: string } = {},
): TopicEvent {
  nextId += 1;
  return {
    id: String(nextId),
    timestamp: options.timestamp ?? 1_000,
    fields: {
      kind,
      deliveryId: options.deliveryId ?? `delivery-${nextId}`,
      payload: options.rawPayload ?? JSON.stringify(payload),
    },
  };
}

function repositoryPayload(action: string, extra: Record<string, unknown> = {}, installationId = 7) {
  return { action, repository: { id: 101, full_name: 'acme/repo' }, installation: { id: installationId }, ...extra };
}

function setup(
  options: {
    links?: Link[];
    modes?: Record<string, PlatformGithubModeRecord>;
    github?: GithubWebhookDispatchIntegration;
    ingestFactoryEvent?: GithubEventDeliveryConfig['ingestFactoryEvent'];
  } = {},
) {
  const dispatch = vi.fn<typeof dispatchGithubWebhook>().mockResolvedValue({
    delivered: 1,
    failed: 0,
    skipped: 0,
    ignored: false,
  });
  const ingestFactoryEvent = options.ingestFactoryEvent ?? vi.fn(async () => ({ status: 'committed' }));
  const github = options.github ?? createGithub();
  const { repositories, source } = linkedRepositories(
    options.links ?? [{ installationId: 7, repositoryId: 101, orgId: 'org-1' }],
  );
  const reconcile = vi.fn();
  const onDependabotAlert = vi.fn();
  const subscription = legacyGithubTopicSubscription({
    delivery: { controller: {} as never, github, ingestFactoryEvent, dispatch },
    repositories,
    modes: new PlatformGithubModes(() => modeStorage(options.modes)),
    reconcile,
    onDependabotAlert,
  });
  const log = logger();
  return {
    subscription,
    route: (event: TopicEvent) => subscription.route(event, { logger: log as never }),
    dispatch,
    ingestFactoryEvent,
    github,
    source,
    reconcile,
    onDependabotAlert,
    log,
  };
}

describe('legacy GitHub topic events', () => {
  it('reads the github-app topic and reconciles through the integration', () => {
    const { subscription, reconcile } = setup();
    expect(subscription.topic).toBe('github-app');
    subscription.reconcile?.();
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('parses the published fields into the webhook Factory handles', () => {
    const payload = repositoryPayload('opened');
    expect(parseLegacyGithubTopicEvent(topicEvent('pull_request', payload, { deliveryId: 'd-1' }))).toEqual({
      event: 'pull_request',
      deliveryId: 'd-1',
      payload,
    });
    expect(parseLegacyGithubTopicEvent(topicEvent('pull_request', {}, { rawPayload: 'not json' }))).toBeNull();
    expect(parseLegacyGithubTopicEvent(topicEvent('pull_request', [] as never))).toBeNull();
    expect(parseLegacyGithubTopicEvent(topicEvent('star', repositoryPayload('created')))).toBeNull();
  });

  it('skips malformed events without failing, so they do not block the topic', async () => {
    const { route, dispatch, ingestFactoryEvent, log } = setup();
    await expect(route(topicEvent('pull_request', {}, { rawPayload: '{' }))).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
    expect(ingestFactoryEvent).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'Platform GitHub: skipped a malformed github-app event',
      expect.objectContaining({ eventId: expect.any(String) }),
    );
  });

  it('forwards created PR comments and PR verdict edits to Factory rules, never issue comment edits', async () => {
    const { route, dispatch, ingestFactoryEvent } = setup();
    const events = [
      topicEvent('pull_request_review', repositoryPayload('submitted'), { deliveryId: 'review' }),
      topicEvent('issue_comment', repositoryPayload('created'), { deliveryId: 'comment' }),
      topicEvent('issue_comment', repositoryPayload('edited'), { deliveryId: 'comment-edited' }),
      topicEvent('issue_comment', repositoryPayload('edited', { issue: { pull_request: { url: 'pr' } } }), {
        deliveryId: 'pr-comment-edited',
      }),
      topicEvent('pull_request_review', repositoryPayload('edited'), { deliveryId: 'review-edited' }),
    ];
    for (const event of events) await route(event);

    expect(vi.mocked(ingestFactoryEvent!).mock.calls.map(([event]) => event.deliveryId)).toEqual([
      'review',
      'comment',
      'pr-comment-edited',
      'review-edited',
    ]);
    expect(dispatch).toHaveBeenCalledTimes(5);
  });

  it("forwards issue label and assignee changes to Factory rules, so they reach the card's routes", async () => {
    const { route, ingestFactoryEvent } = setup();
    for (const action of ['labeled', 'unlabeled', 'assigned', 'unassigned', 'milestoned']) {
      await route(topicEvent('issues', repositoryPayload(action), { deliveryId: `issue-${action}` }));
    }
    for (const action of ['labeled', 'reopened', 'edited']) {
      await route(topicEvent('pull_request', repositoryPayload(action), { deliveryId: `pr-${action}` }));
    }

    expect(vi.mocked(ingestFactoryEvent!).mock.calls.map(([event]) => event.deliveryId)).toEqual([
      'issue-labeled',
      'issue-unlabeled',
      'issue-assigned',
      'issue-unassigned',
      'pr-labeled',
      'pr-reopened',
    ]);
  });

  it('feeds default-branch pushes to Factory rules', async () => {
    const { route, ingestFactoryEvent } = setup();
    await route(topicEvent('push', { ...repositoryPayload('push'), ref: 'refs/heads/main' }));
    expect(ingestFactoryEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'push' }));
  });

  it('fails the event when Factory ingestion fails, so the events worker replays it', async () => {
    const ingestFactoryEvent = vi
      .fn<NonNullable<GithubEventDeliveryConfig['ingestFactoryEvent']>>()
      .mockRejectedValueOnce(new Error('storage down'))
      .mockResolvedValue({ status: 'committed' });
    const { route, dispatch } = setup({ ingestFactoryEvent });
    const event = topicEvent('pull_request', repositoryPayload('opened'));

    await expect(route(event)).rejects.toThrow('storage down');
    expect(dispatch).not.toHaveBeenCalled();
    await route(event);
    expect(ingestFactoryEvent).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('handles a replayed delivery once, but retries one that failed', async () => {
    const ingestFactoryEvent = vi
      .fn<NonNullable<GithubEventDeliveryConfig['ingestFactoryEvent']>>()
      .mockRejectedValueOnce(new Error('storage down'))
      .mockResolvedValue({ status: 'committed' });
    const { route, dispatch, log } = setup({ ingestFactoryEvent });
    const failed = topicEvent('pull_request', repositoryPayload('opened'), { deliveryId: 'failed-once' });
    const handled = topicEvent('pull_request', repositoryPayload('opened'), { deliveryId: 'handled' });

    await expect(route(failed)).rejects.toThrow('storage down');
    await route(failed);
    await route(handled);
    await route({ ...handled, id: `${handled.id}-replay` });

    expect(ingestFactoryEvent.mock.calls.map(([event]) => event.deliveryId)).toEqual([
      'failed-once',
      'failed-once',
      'handled',
    ]);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(log.debug).toHaveBeenCalledWith('Platform GitHub: skipped a replayed github-app delivery', {
      deliveryId: 'handled',
    });
  });

  it('logs failed subscription deliveries without failing the event, so one bad target does not block the topic', async () => {
    const { route, dispatch, log } = setup();
    dispatch.mockResolvedValueOnce({ delivered: 1, failed: 1, skipped: 0, ignored: false });
    await expect(
      route(topicEvent('pull_request', repositoryPayload('synchronize'), { deliveryId: 'd-1' })),
    ).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith('Platform GitHub event completed with failed subscription deliveries', {
      deliveryId: 'd-1',
      delivered: 1,
      failed: 1,
    });
  });

  it('hands the dispatch its integration, so a woken session can be attributed to its owner', async () => {
    const { route, dispatch, github } = setup();
    await route(topicEvent('pull_request', repositoryPayload('synchronize')));
    expect(dispatch.mock.calls[0]?.[1].github).toBe(github);
  });

  describe('linked-project scoping', () => {
    it('drops events for repositories no Factory project links', async () => {
      const { route, dispatch, ingestFactoryEvent } = setup({ links: [] });
      await route(topicEvent('pull_request', repositoryPayload('opened')));
      expect(dispatch).not.toHaveBeenCalled();
      expect(ingestFactoryEvent).not.toHaveBeenCalled();
    });

    it('drops events that name a different installation of a linked repository', async () => {
      const { route, dispatch } = setup();
      await route(topicEvent('pull_request', repositoryPayload('opened', {}, 99)));
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('drops events whose payload names no repository or installation', async () => {
      const { route, dispatch } = setup();
      await route(topicEvent('pull_request', { action: 'opened', installation: { id: 7 } }));
      await route(topicEvent('pull_request', { action: 'opened', repository: { id: 101 } }));
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('reads the links once, not per event', async () => {
      const { route, source, dispatch } = setup();
      await route(topicEvent('pull_request', repositoryPayload('opened')));
      await route(topicEvent('pull_request', repositoryPayload('synchronize')));
      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(source.listConfiguredExternalKeys).toHaveBeenCalledTimes(1);
    });
  });

  describe('orgs that switched to the Mastra Factory apps', () => {
    const switched: PlatformGithubModeRecord = {
      version: 1,
      mode: 'connect',
      switchedAt: 5_000,
      installations: [
        {
          accountLogin: 'acme',
          installationId: 300,
          connectionId: 'conn-github',
          reviewsConnectionId: 'conn-reviews',
          legacyInstallationId: 7,
        },
      ],
    };

    it('runs a legacy event published before the switch, attributed to the re-pointed installation', async () => {
      const { route, dispatch, ingestFactoryEvent } = setup({
        links: [{ installationId: 300, repositoryId: 101, orgId: 'org-1' }],
        modes: { 'org-1': switched },
      });
      await route(topicEvent('pull_request', repositoryPayload('opened'), { timestamp: 4_000 }));
      expect(ingestFactoryEvent).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ installation: { id: 300 } }) }),
      );
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it('drops a legacy event published after the switch: the connect topic delivers it', async () => {
      const { route, dispatch, ingestFactoryEvent } = setup({
        links: [{ installationId: 300, repositoryId: 101, orgId: 'org-1' }],
        modes: { 'org-1': switched },
      });
      await route(topicEvent('pull_request', repositoryPayload('opened'), { timestamp: 5_000 }));
      expect(dispatch).not.toHaveBeenCalled();
      expect(ingestFactoryEvent).not.toHaveBeenCalled();
    });

    it('drops a pre-switch event from an installation the org did not switch from', async () => {
      const { route, dispatch } = setup({
        links: [{ installationId: 300, repositoryId: 101, orgId: 'org-1' }],
        modes: { 'org-1': switched },
      });
      await route(topicEvent('pull_request', repositoryPayload('opened', {}, 8), { timestamp: 4_000 }));
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('still runs the event for another org that links the repository and has not switched', async () => {
      const { route, dispatch } = setup({
        links: [
          { installationId: 300, repositoryId: 101, orgId: 'org-1' },
          { installationId: 7, repositoryId: 101, orgId: 'org-2' },
        ],
        modes: { 'org-1': switched },
      });
      await route(topicEvent('pull_request', repositoryPayload('opened'), { timestamp: 9_000 }));
      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });

  it('asks for a Dependabot sync when an alert changes, without dispatching it', async () => {
    const { route, onDependabotAlert, dispatch } = setup();
    await route(topicEvent('dependabot_alert', repositoryPayload('created')));
    expect(onDependabotAlert).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  describe('sender gate', () => {
    function notification(sender: string, senderType = 'Bot', kind = 'review-changes-requested') {
      return {
        kind,
        metadata: {
          sender,
          senderType,
          repository: 'acme/repo',
          repositoryId: 101,
          installationId: 7,
          pullRequestNumber: 17,
        },
      } as never;
    }

    async function captureGate(github?: GithubWebhookDispatchIntegration) {
      const context = setup({ github });
      await context.route(topicEvent('pull_request', repositoryPayload('synchronize')));
      const dependencies = context.dispatch.mock.calls[0]?.[1];
      if (!dependencies?.isAuthorizedSender) throw new Error('dispatch was not called with a sender gate');
      return { dependencies, log: context.log, github: context.github };
    }

    it('authorizes default bots regardless of login casing', async () => {
      const { dependencies } = await captureGate();
      await expect(dependencies.isAuthorizedSender?.(notification('CodeRabbitAI[bot]'))).resolves.toBe(true);
      await expect(dependencies.isAuthorizedSender?.(notification('devin-ai-integration[bot]'))).resolves.toBe(true);
    });

    it('authorizes bots the deployment opted in and rejects the rest', async () => {
      const { dependencies } = await captureGate(createGithub({ authorizedBots: ['OpenSWEBot'] }));
      await expect(dependencies.isAuthorizedSender?.(notification('openswebot'))).resolves.toBe(true);
      // Opting in extends the defaults instead of replacing them.
      await expect(dependencies.isAuthorizedSender?.(notification('coderabbitai[bot]'))).resolves.toBe(true);
      await expect(dependencies.isAuthorizedSender?.(notification('other-reviewer[bot]'))).resolves.toBe(false);
    });

    it('rejects unconfigured bots without consulting collaborator permissions', async () => {
      const { dependencies, github } = await captureGate();
      await expect(dependencies.isAuthorizedSender?.(notification('openswebot'))).resolves.toBe(false);
      expect(github.getRepositoryCollaboratorPermission).not.toHaveBeenCalled();
    });

    it('gates the kinds the webhook classifier actually emits', async () => {
      const { dependencies } = await captureGate();
      for (const kind of [
        'issue-comment-created',
        'review-comment-created',
        'review-approved',
        'review-changes-requested',
        'review-submitted',
        'review-dismissed',
      ]) {
        await expect(dependencies.isAuthorizedSender?.(notification('other-reviewer[bot]', 'Bot', kind))).resolves.toBe(
          false,
        );
      }
      await expect(
        dependencies.isAuthorizedSender?.(notification('other-reviewer[bot]', 'Bot', 'pull-request-merged')),
      ).resolves.toBe(true);
    });

    it('still permission-checks human senders', async () => {
      const { dependencies, github } = await captureGate();
      await expect(dependencies.isAuthorizedSender?.(notification('octocat', 'User'))).resolves.toBe(true);
      expect(github.getRepositoryCollaboratorPermission).toHaveBeenCalledWith(
        7,
        'acme/repo',
        'octocat',
        expect.anything(),
      );
    });

    it('logs dropped events so an unauthorized sender is not silent', async () => {
      const { dependencies, log } = await captureGate();
      dependencies.onSenderRejected?.(notification('openswebot'));
      expect(log.debug).toHaveBeenCalledWith(
        'Platform GitHub event dropped: sender not authorized',
        expect.objectContaining({ sender: 'openswebot', repository: 'acme/repo', kind: 'review-changes-requested' }),
      );
    });
  });
});
