import { describe, expect, it, vi } from 'vitest';

import { GithubAppIdentity } from '../../github/app-identity.js';
import type { dispatchGithubWebhook, GithubWebhookDispatchIntegration } from '../../github/webhook.js';
import type { PlatformConnectEventDelivery } from '../foundation/index.js';
import {
  connectGithubEventHandler,
  FACTORY_GITHUB_PROVIDER_KEY,
  FACTORY_REVIEWS_GITHUB_PROVIDER_KEY,
} from './connect-events.js';
import { legacyGithubTopicSubscription } from './legacy-events.js';
import { LinkedGithubRepositories } from './linked-repositories.js';
import { PlatformGithubModes } from './mode.js';
import type { PlatformGithubModeRecord, PlatformGithubModeStorage } from './mode.js';

const SWITCHED_AT = 10_000;
const switched: PlatformGithubModeRecord = {
  version: 1,
  mode: 'connect',
  switchedAt: SWITCHED_AT,
  switchedBy: 'admin-1',
  installations: [
    { accountLogin: 'acme', installationId: 900, connectionId: 'conn-github', reviewsConnectionId: 'conn-reviews' },
  ],
};

function modeStorage(records: Record<string, PlatformGithubModeRecord>) {
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

function linked(links: { installationId: number; repositoryId: number; orgId: string }[]) {
  return new LinkedGithubRepositories(() => ({
    listConfiguredExternalKeys: async () =>
      links.map(link => ({
        installationExternalId: String(link.installationId),
        repositoryExternalId: String(link.repositoryId),
      })),
    listByExternalRepository: async (args: { installationExternalId: string; repositoryExternalId: string }) =>
      links
        .filter(
          link =>
            String(link.installationId) === args.installationExternalId &&
            String(link.repositoryId) === args.repositoryExternalId,
        )
        .map(link => ({ orgId: link.orgId, factoryProjectId: 'proj-1' }) as never),
  }));
}

function setup(
  options: {
    modes?: Record<string, PlatformGithubModeRecord>;
    links?: { installationId: number; repositoryId: number; orgId: string }[];
  } = {},
) {
  const dispatch = vi.fn<typeof dispatchGithubWebhook>().mockResolvedValue({
    delivered: 1,
    failed: 0,
    skipped: 0,
    ignored: false,
  });
  const ingestFactoryEvent = vi.fn(async () => ({ status: 'committed' }) as never);
  const github = {
    integrationStorage: {} as never,
    sourceControlStorage: { sessions: { getBySessionId: async () => null } },
    identity: new GithubAppIdentity('mastra-platform', ['mastra-factory', 'mastra-factory-reviews']),
    slug: 'mastra-platform',
    getRepositoryCollaboratorPermission: vi.fn(async () => 'none' as const),
  } as unknown as GithubWebhookDispatchIntegration;
  const onDependabotAlert = vi.fn();
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const handle = connectGithubEventHandler({
    delivery: { controller: {} as never, github, ingestFactoryEvent, dispatch },
    repositories: linked(options.links ?? [{ installationId: 900, repositoryId: 101, orgId: 'org-1' }]),
    modes: new PlatformGithubModes(() => modeStorage(options.modes ?? { 'org-1': switched })),
    onDependabotAlert,
    logger: log,
  });
  return { handle, dispatch, ingestFactoryEvent, github, onDependabotAlert, log };
}

let nextId = 0;
function connectEvent(
  eventType: string,
  payload: Record<string, unknown>,
  options: Partial<PlatformConnectEventDelivery> = {},
): PlatformConnectEventDelivery {
  nextId += 1;
  const sourceEventId = options.sourceEventId ?? `delivery-${nextId}`;
  return {
    id: String(nextId),
    timestamp: SWITCHED_AT + 1,
    connectionId: 'conn-github',
    integrationId: FACTORY_GITHUB_PROVIDER_KEY,
    eventType,
    sourceEventId,
    payload,
    unverified: false,
    dedupeKey: sourceEventId,
    ...options,
  };
}

function pullRequestPayload(action = 'opened', installationId = 900) {
  return {
    action,
    repository: { id: 101, full_name: 'acme/repo' },
    installation: { id: installationId },
    pull_request: { number: 17, head: { sha: 'h1' } },
    sender: { login: 'octocat', type: 'User' },
  };
}

describe('factory-github connect events', () => {
  it('delivers a switched org’s events like the legacy topic does', async () => {
    const { handle, dispatch, ingestFactoryEvent } = setup();
    await handle(
      connectEvent('pull_request.opened', pullRequestPayload(), { sourceEventId: 'gh-1', dedupeKey: 'gh-1' }),
    );
    expect(ingestFactoryEvent).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]).toEqual({
      event: 'pull_request',
      deliveryId: 'gh-1',
      payload: pullRequestPayload(),
    });
  });

  it('ignores the reviews app’s events', async () => {
    const { handle, dispatch, ingestFactoryEvent } = setup();
    await handle(
      connectEvent('pull_request.opened', pullRequestPayload(), {
        integrationId: FACTORY_REVIEWS_GITHUB_PROVIDER_KEY,
        connectionId: 'conn-reviews',
      }),
    );
    expect(dispatch).not.toHaveBeenCalled();
    expect(ingestFactoryEvent).not.toHaveBeenCalled();
  });

  it('never acts on an event the platform could not verify', async () => {
    const { handle, dispatch, ingestFactoryEvent, log } = setup();
    await handle(connectEvent('pull_request.opened', pullRequestPayload(), { unverified: true }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(ingestFactoryEvent).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'Platform GitHub: dropped an unverified factory-github event',
      expect.objectContaining({ eventType: 'pull_request.opened' }),
    );
  });

  it('ignores orgs that have not switched, and events from before the switch', async () => {
    const legacy = setup({ modes: { 'org-1': { version: 1, mode: 'legacy' } } });
    await legacy.handle(connectEvent('pull_request.opened', pullRequestPayload()));
    expect(legacy.dispatch).not.toHaveBeenCalled();

    const early = setup();
    await early.handle(connectEvent('pull_request.opened', pullRequestPayload(), { timestamp: SWITCHED_AT - 1 }));
    expect(early.dispatch).not.toHaveBeenCalled();
  });

  it('only accepts an installation through the connection that serves it', async () => {
    const { handle, dispatch } = setup();
    await handle(connectEvent('pull_request.opened', pullRequestPayload(), { connectionId: 'conn-other' }));
    await handle(connectEvent('pull_request.opened', pullRequestPayload('opened', 901)));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('ignores repositories no project links', async () => {
    const { handle, dispatch } = setup({ links: [{ installationId: 900, repositoryId: 202, orgId: 'org-1' }] });
    await handle(connectEvent('pull_request.opened', pullRequestPayload()));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('handles a replayed delivery once, but retries one that failed', async () => {
    const { handle, dispatch } = setup();
    dispatch.mockRejectedValueOnce(new Error('boom'));
    const first = connectEvent('pull_request.opened', pullRequestPayload(), {
      sourceEventId: 'gh-r',
      dedupeKey: 'gh-r',
    });
    await expect(handle(first)).rejects.toThrow('boom');
    await handle(first);
    await handle(first);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('asks for a Dependabot sync instead of dispatching an alert', async () => {
    const { handle, dispatch, onDependabotAlert } = setup();
    await handle(connectEvent('dependabot_alert.created', { alert: { number: 1 } }));
    expect(onDependabotAlert).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('skips payloads the platform could not parse', async () => {
    const { handle, dispatch } = setup();
    await handle(connectEvent('pull_request.opened', {}, { payload: '{', payloadParseError: true }));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('recognizes both Factory apps’ bots as Factory, and gates other bots', async () => {
    const { handle, dispatch } = setup();
    await handle(connectEvent('pull_request.synchronize', pullRequestPayload('synchronize')));
    const gate = dispatch.mock.calls[0]?.[1]?.isAuthorizedSender;
    if (!gate) throw new Error('dispatch was not called with a sender gate');
    const notification = (sender: string) =>
      ({
        kind: 'review-changes-requested',
        metadata: {
          sender,
          senderType: 'Bot',
          repository: 'acme/repo',
          repositoryId: 101,
          installationId: 900,
          pullRequestNumber: 17,
        },
      }) as never;
    await expect(gate(notification('mastra-factory[bot]'))).resolves.toBe(true);
    await expect(gate(notification('mastra-factory-reviews[bot]'))).resolves.toBe(true);
    await expect(gate(notification('mastra-platform[bot]'))).resolves.toBe(true);
    await expect(gate(notification('other-reviewer[bot]'))).resolves.toBe(false);
  });

  it('wakes only the orgs each app serves when orgs on different apps link the same repository', async () => {
    // org-1 switched to installation 900; org-2 still links the repository through the legacy app's installation 7.
    const repositories = linked([
      { installationId: 900, repositoryId: 101, orgId: 'org-1' },
      { installationId: 7, repositoryId: 101, orgId: 'org-2' },
    ]);
    const modes = new PlatformGithubModes(() => modeStorage({ 'org-1': switched }));
    const subscriptions = [
      { id: 'sub-org-1', orgId: 'org-1', status: 'open' },
      { id: 'sub-org-2', orgId: 'org-2', status: 'open' },
    ];
    const github = {
      integrationStorage: { subscriptions: { listByTarget: async () => subscriptions } },
      sourceControlStorage: { sessions: { getBySessionId: async () => null } },
      identity: new GithubAppIdentity('mastra-platform', ['mastra-factory', 'mastra-factory-reviews']),
      slug: 'mastra-platform',
      getRepositoryCollaboratorPermission: vi.fn(async () => 'none' as const),
    } as unknown as GithubWebhookDispatchIntegration;
    const woken: string[][] = [];
    const dispatch = vi.fn<typeof dispatchGithubWebhook>(async (_event, context) => {
      const rows = await context.listSubscriptions({ owner: 'acme', repo: 'repo', number: 17 } as never, undefined);
      woken.push(rows.map(row => row.id));
      return { delivered: rows.length, failed: 0, skipped: 0, ignored: false };
    });
    const delivery = {
      controller: {} as never,
      github,
      ingestFactoryEvent: vi.fn(async () => ({}) as never),
      dispatch,
    };
    const connect = connectGithubEventHandler({ delivery, repositories, modes });
    const legacy = legacyGithubTopicSubscription({ delivery, repositories, modes, reconcile: vi.fn() });

    // GitHub sends each app its own copy of one comment, under its own delivery id.
    await connect(connectEvent('issue_comment.created', pullRequestPayload('created', 900)));
    await legacy.route(
      {
        id: 'legacy-1',
        timestamp: SWITCHED_AT + 1,
        fields: {
          kind: 'issue_comment',
          deliveryId: 'legacy-delivery-1',
          payload: JSON.stringify(pullRequestPayload('created', 7)),
        },
      },
      { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never },
    );

    expect(woken).toEqual([['sub-org-1'], ['sub-org-2']]);
  });

  it("re-reads links and modes before dropping an event another replica's switch made this one's", async () => {
    // This replica holds the events lease and cached org-1 as legacy, linked through the legacy installation.
    const links = [{ installationId: 7, repositoryId: 101, orgId: 'org-1' }];
    const storage = modeStorage({});
    const reads = vi.fn();
    const counted = {
      ...storage,
      settings: {
        ...storage.settings,
        get: async (orgId: string, userId: string) => (reads(), storage.settings.get(orgId, userId)),
      },
    } as unknown as PlatformGithubModeStorage;
    const repositories = linked(links);
    const modes = new PlatformGithubModes(() => counted);
    let now = 100_000;
    const dispatch = vi.fn<typeof dispatchGithubWebhook>().mockResolvedValue({
      delivered: 1,
      failed: 0,
      skipped: 0,
      ignored: false,
    });
    const github = {
      integrationStorage: {} as never,
      sourceControlStorage: { sessions: { getBySessionId: async () => null } },
      identity: new GithubAppIdentity('mastra-platform', ['mastra-factory']),
      slug: 'mastra-platform',
      getRepositoryCollaboratorPermission: vi.fn(async () => 'none' as const),
    } as unknown as GithubWebhookDispatchIntegration;
    const handle = connectGithubEventHandler({
      delivery: { controller: {} as never, github, ingestFactoryEvent: vi.fn(async () => ({}) as never), dispatch },
      repositories,
      modes,
      now: () => now,
    });
    await expect(repositories.forRepository(101)).resolves.toHaveLength(1);
    await expect(modes.get('org-1')).resolves.toMatchObject({ mode: 'legacy' });

    // Another replica switches org-1: links are re-pointed and the mode saved, but no broadcast has arrived yet.
    links[0] = { installationId: 900, repositoryId: 101, orgId: 'org-1' };
    await storage.settings.save('org-1', '__platform_github_mode__', switched);

    await handle(connectEvent('pull_request.opened', pullRequestPayload()));
    expect(dispatch).toHaveBeenCalledTimes(1);

    // An event for a repository Factory doesn't link never sends this replica back to storage.
    reads.mockClear();
    const invalidate = vi.spyOn(repositories, 'invalidate');
    now += 60_000;
    await handle(
      connectEvent('pull_request.opened', {
        ...pullRequestPayload(),
        repository: { id: 555, full_name: 'acme/other' },
      }),
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(reads).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
