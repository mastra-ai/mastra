import type { WorkerDeps } from '@mastra/core/worker';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createBoardRegistry } from '../../../boards/index.js';
import type { FactoryLinearRuleContext } from '../../../rules/types.js';
import { createFactoryStorageForTests } from '../../../storage/test-utils.js';
import type { IntegrationContext } from '../../base.js';
import type { LinearRulesIngress } from '../../linear/rules.js';
import { PlatformConnectEventPoller } from '../foundation/connect-event-poller.js';
import type { PlatformConnectEventPollerStorage } from '../foundation/connect-event-poller.js';
import type { PlatformConnectEventDelivery } from '../foundation/connect-events.js';
import { handleLinearConnectEvent } from './connect-events.js';
import type { LinearConnectEventDeps } from './connect-events.js';
import { PlatformLinearIntegration } from './integration.js';
import { linearWorkspace, startFakeLinear } from './test-utils.js';
import type { FakeLinear } from './test-utils.js';

/** Linear's raw webhook body for an issue update in `workspace-1`. */
function issueWebhook(data: Record<string, unknown> = {}, body: Record<string, unknown> = {}) {
  return {
    action: 'update',
    type: 'Issue',
    createdAt: '2026-11-13T12:00:00.000Z',
    organizationId: 'workspace-1',
    url: 'https://linear.app/acme/issue/ENG-42',
    webhookTimestamp: 1_763_035_200_000,
    data: {
      id: 'issue-1',
      identifier: 'ENG-42',
      title: 'Fix intake',
      url: 'https://linear.app/acme/issue/ENG-42',
      state: { name: 'In Progress', type: 'started' },
      team: { key: 'ENG', name: 'Engineering' },
      assignee: { name: 'Ada' },
      user: { name: 'Grace' },
      labels: [{ name: 'bug' }],
      priorityLabel: 'High',
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-11-13T12:00:00Z',
      ...data,
    },
    ...body,
  };
}

function delivery(
  payload: unknown,
  overrides: Partial<PlatformConnectEventDelivery> = {},
): PlatformConnectEventDelivery {
  return {
    id: '1763035200000-0',
    timestamp: 1_763_035_200_000,
    connectionId: 'conn-workspace-1',
    integrationId: 'linear',
    eventType: 'Issue.update',
    sourceEventId: 'delivery-1',
    payload,
    unverified: false,
    dedupeKey: 'delivery-1',
    ...overrides,
  };
}

const projectA = { id: 'project-a', orgId: 'org-a' };
const projectB = { id: 'project-b', orgId: 'org-b' };

/**
 * Stub deps: `tracked` maps `${orgId}:${projectId}` to the Linear source keys that project has a card for.
 * `conn-workspace-1` belongs to org A (scoped to project A) unless `resourceId` says otherwise.
 */
function stubDeps(
  tracked: Record<string, string[]> = { 'org-a:project-a': ['linear:ENG-42'] },
  { resourceId = 'project-a' }: { resourceId?: string | null } = {},
) {
  const ingested: LinearRulesIngress[] = [];
  const deps = {
    connectionWorkspace: vi.fn(async (connectionId: string) =>
      connectionId === 'conn-workspace-1' ? { linearWorkspaceId: 'workspace-1', resourceId } : null,
    ),
    projects: { listAll: vi.fn(async () => [projectA, projectB]) },
    workItems: {
      copyLegacyCards: vi.fn(async () => {}),
      listShared: vi.fn(async ({ orgId, factoryProjectId }: { orgId: string; factoryProjectId: string }) =>
        (tracked[`${orgId}:${factoryProjectId}`] ?? []).map(externalId => ({
          id: `card-${externalId}`,
          externalSource: {
            integrationId: 'linear',
            type: 'issue',
            externalId,
            url: `https://linear.app/acme/issue/${externalId.replace(/^linear:/, '')}`,
          },
          workItem: { metadata: {} },
        })),
      ),
    },
    ingest: vi.fn(async (input: LinearRulesIngress) => {
      ingested.push(input);
    }),
    recentKeys: new Set<string>(),
    onUnverifiedDropped: vi.fn(),
  };
  return { deps: deps as unknown as LinearConnectEventDeps & typeof deps, ingested };
}

describe('handleLinearConnectEvent', () => {
  it("updates a tracked issue's cards from the webhook", async () => {
    const { deps, ingested } = stubDeps();

    await expect(handleLinearConnectEvent(delivery(issueWebhook()), deps)).resolves.toBe('dispatched');

    expect(ingested).toEqual([
      {
        orgId: 'org-a',
        userId: 'linear-connect-events',
        factoryProjectId: 'project-a',
        issues: [
          {
            id: 'issue-1',
            identifier: 'ENG-42',
            title: 'Fix intake',
            url: 'https://linear.app/acme/issue/ENG-42',
            state: 'In Progress',
            stateType: 'started',
            priorityLabel: 'High',
            assignee: 'Ada',
            creator: 'Grace',
            team: 'Engineering',
            labels: ['bug'],
            createdAt: '2026-07-01T00:00:00Z',
            updatedAt: '2026-11-13T12:00:00Z',
          },
        ],
      },
    ]);
    expect(deps.workItems.copyLegacyCards).toHaveBeenCalledWith({
      orgId: 'org-a',
      factoryProjectId: 'project-a',
      sources: [{ integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42' }],
    });
  });

  it("never files an issue in another tenant's project that has no card for it", async () => {
    // Both orgs' projects exist; only org A tracks ENG-42.
    const { deps, ingested } = stubDeps({ 'org-a:project-a': ['linear:ENG-42'], 'org-b:project-b': ['linear:ENG-7'] });

    await handleLinearConnectEvent(delivery(issueWebhook()), deps);

    expect(ingested.map(input => `${input.orgId}:${input.factoryProjectId}`)).toEqual(['org-a:project-a']);
  });

  it("never updates another workspace's card that shares the issue's identifier", async () => {
    // Org B's ENG-42 lives in a different Linear workspace: its card knows a different issue id.
    const { deps, ingested } = stubDeps({ 'org-a:project-a': ['linear:ENG-42'] });
    deps.workItems.listShared.mockImplementation(async ({ orgId }) =>
      orgId === 'org-b'
        ? [
            {
              id: 'card-b',
              externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42' },
              workItem: { metadata: { linearIssueId: 'issue-in-workspace-2' } },
            },
          ]
        : [
            {
              id: 'card-a',
              externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42' },
              workItem: { metadata: { linearIssueId: 'issue-1' } },
            },
          ],
    );

    await handleLinearConnectEvent(delivery(issueWebhook()), deps);

    expect(ingested.map(input => `${input.orgId}:${input.factoryProjectId}`)).toEqual(['org-a:project-a']);
  });

  it("never updates another org's card that only knows the issue's identifier", async () => {
    // Org A owns the connection and has no card; org B's identifier-only ENG-42 is another workspace's issue.
    const { deps, ingested } = stubDeps({ 'org-b:project-b': ['linear:ENG-42'] });

    await expect(handleLinearConnectEvent(delivery(issueWebhook()), deps)).resolves.toBe('dispatched');

    expect(ingested).toEqual([]);
    expect(deps.workItems.listShared).not.toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-b' }));
  });

  it("matches an org-level connection's identifier-only cards when the deployment has one org", async () => {
    const { deps, ingested } = stubDeps({ 'org-a:project-a': ['linear:ENG-42'] }, { resourceId: null });
    deps.projects.listAll.mockResolvedValue([projectA, { id: 'project-a2', orgId: 'org-a' }]);

    await handleLinearConnectEvent(delivery(issueWebhook()), deps);

    expect(ingested.map(input => `${input.orgId}:${input.factoryProjectId}`)).toEqual(['org-a:project-a']);
  });

  it("never updates an identifier-only card filed from another of the org's workspaces", async () => {
    const { deps, ingested } = stubDeps({}, { resourceId: null });
    deps.projects.listAll.mockResolvedValue([projectA]);
    const card = (url?: string) => ({
      id: 'card-a',
      externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42', ...(url ? { url } : {}) },
      workItem: { metadata: {} },
    });

    for (const url of ['https://linear.app/other/issue/ENG-42', undefined, 'not a url']) {
      deps.workItems.listShared.mockResolvedValueOnce([card(url)]);
      await handleLinearConnectEvent(delivery(issueWebhook(), { dedupeKey: `delivery-${url}` }), deps);
    }
    // Neither URL names a workspace.
    deps.workItems.listShared.mockResolvedValueOnce([card()]);
    await handleLinearConnectEvent(
      delivery(issueWebhook({ url: 'not a url' }, { url: 'not a url' }), { dedupeKey: 'delivery-no-urls' }),
      deps,
    );
    deps.workItems.listShared.mockResolvedValueOnce([card('https://linear.app/acme/issue/ENG-42')]);
    await handleLinearConnectEvent(delivery(issueWebhook(), { dedupeKey: 'delivery-same' }), deps);

    expect(ingested.map(input => input.factoryProjectId)).toEqual(['project-a']);
  });

  it('updates only cards that know the issue id when an org-level connection serves several orgs', async () => {
    // Which org owns the connection can't be told, so an identifier alone never matches.
    const { deps, ingested } = stubDeps({}, { resourceId: null });
    deps.workItems.listShared.mockImplementation(async ({ orgId }) =>
      orgId === 'org-a'
        ? [
            {
              id: 'card-a',
              externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42' },
              workItem: { metadata: {} },
            },
          ]
        : [
            {
              id: 'card-b',
              externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42' },
              workItem: { metadata: { linearIssueId: 'issue-1' } },
            },
          ],
    );

    await handleLinearConnectEvent(delivery(issueWebhook()), deps);

    expect(ingested.map(input => `${input.orgId}:${input.factoryProjectId}`)).toEqual(['org-b:project-b']);
  });

  it('skips an event whose connection is scoped to a Factory project this deployment lacks', async () => {
    const { deps, ingested } = stubDeps(undefined, { resourceId: 'project-gone' });

    await expect(handleLinearConnectEvent(delivery(issueWebhook()), deps)).resolves.toBe('unknown_connection');

    expect(ingested).toEqual([]);
  });

  it('dispatches nothing when no project tracks the issue', async () => {
    const { deps, ingested } = stubDeps({});

    await expect(handleLinearConnectEvent(delivery(issueWebhook()), deps)).resolves.toBe('dispatched');

    expect(ingested).toEqual([]);
  });

  it('finds a card filed under an issue identifier Linear has since renamed', async () => {
    const { deps, ingested } = stubDeps({});
    deps.workItems.listShared.mockImplementation(async ({ orgId }) =>
      orgId === 'org-a'
        ? [
            {
              id: 'card-old',
              externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:OPS-3' },
              workItem: { metadata: { linearIssueId: 'issue-1' } },
            },
          ]
        : [],
    );

    await handleLinearConnectEvent(delivery(issueWebhook()), deps);

    expect(ingested.map(input => input.factoryProjectId)).toEqual(['project-a']);
  });

  it('ignores comment events and other non-Issue events', async () => {
    const { deps, ingested } = stubDeps();
    const comment = {
      action: 'create',
      type: 'Comment',
      organizationId: 'workspace-1',
      data: { id: 'comment-1', body: 'On it', issueId: 'issue-1', issue: { id: 'issue-1', identifier: 'ENG-42' } },
    };

    await expect(handleLinearConnectEvent(delivery(comment, { eventType: 'Comment.create' }), deps)).resolves.toBe(
      'ignored',
    );

    expect(ingested).toEqual([]);
    expect(deps.connectionWorkspace).not.toHaveBeenCalled();
  });

  it('skips an Issue payload missing the fields a card needs', async () => {
    const { deps, ingested } = stubDeps();

    await expect(handleLinearConnectEvent(delivery(issueWebhook({ identifier: undefined })), deps)).resolves.toBe(
      'ignored',
    );
    await expect(
      handleLinearConnectEvent(
        delivery('not json', { payloadParseError: true, dedupeKey: 'delivery-2', sourceEventId: 'delivery-2' }),
        deps,
      ),
    ).resolves.toBe('ignored');

    expect(ingested).toEqual([]);
  });

  it("handles a replayed delivery once, keyed on Linear's delivery id", async () => {
    const { deps, ingested } = stubDeps();

    await handleLinearConnectEvent(delivery(issueWebhook()), deps);
    // The same delivery, read again under a new stream id (at-least-once delivery).
    await expect(handleLinearConnectEvent(delivery(issueWebhook(), { id: '1763035299999-0' }), deps)).resolves.toBe(
      'duplicate',
    );
    await handleLinearConnectEvent(delivery(issueWebhook(), { dedupeKey: 'delivery-2' }), deps);

    expect(ingested).toHaveLength(2);
    expect([...deps.recentKeys]).toEqual(['linear:conn-workspace-1:delivery-1', 'linear:conn-workspace-1:delivery-2']);
  });

  it("handles equal stream ids on two connections' logs as two events", async () => {
    const { deps, ingested } = stubDeps({ 'org-a:project-a': ['linear:ENG-42'] });
    deps.connectionWorkspace.mockImplementation(async (connectionId: string) =>
      connectionId.startsWith('conn-workspace-') ? { linearWorkspaceId: 'workspace-1', resourceId: 'project-a' } : null,
    );
    const withoutSourceId = { sourceEventId: undefined, dedupeKey: '1763035200000-0' };

    await handleLinearConnectEvent(delivery(issueWebhook(), withoutSourceId), deps);
    await expect(
      handleLinearConnectEvent(
        delivery(issueWebhook(), { ...withoutSourceId, connectionId: 'conn-workspace-2' }),
        deps,
      ),
    ).resolves.toBe('dispatched');
    // The same entry on the same connection is still a replay.
    await expect(handleLinearConnectEvent(delivery(issueWebhook(), withoutSourceId), deps)).resolves.toBe('duplicate');

    expect(ingested).toHaveLength(2);
  });

  it('drops an unverified event without reading its payload', async () => {
    const { deps, ingested } = stubDeps();

    await expect(handleLinearConnectEvent(delivery(issueWebhook(), { unverified: true }), deps)).resolves.toBe(
      'unverified',
    );

    expect(ingested).toEqual([]);
    expect(deps.connectionWorkspace).not.toHaveBeenCalled();
    expect(deps.onUnverifiedDropped).toHaveBeenCalledTimes(1);
  });

  it("rejects an event whose payload names another workspace than the connection's", async () => {
    const { deps, ingested } = stubDeps();

    await expect(
      handleLinearConnectEvent(delivery(issueWebhook({}, { organizationId: 'workspace-9' })), deps),
    ).resolves.toBe('workspace_mismatch');

    expect(ingested).toEqual([]);
    expect(deps.recentKeys.size).toBe(0);
  });

  it('skips an event for a connection the project does not list as active', async () => {
    const { deps, ingested } = stubDeps();

    await expect(
      handleLinearConnectEvent(delivery(issueWebhook(), { connectionId: 'conn-elsewhere' }), deps),
    ).resolves.toBe('unknown_connection');

    expect(ingested).toEqual([]);
  });

  it('throws when a project cannot take the update, so the worker retries, and still updates the others', async () => {
    // Two of org A's projects track the issue (another org's identifier-only card is never matched).
    const { deps, ingested } = stubDeps({
      'org-a:project-a': ['linear:ENG-42'],
      'org-a:project-a2': ['linear:ENG-42'],
    });
    deps.projects.listAll.mockResolvedValue([projectA, { id: 'project-a2', orgId: 'org-a' }]);
    deps.ingest.mockImplementationOnce(async () => {
      throw new Error('storage unavailable');
    });

    await expect(handleLinearConnectEvent(delivery(issueWebhook()), deps)).rejects.toThrow(
      'Linear issue ENG-42 could not be applied to project-a: storage unavailable',
    );
    expect(ingested.map(input => input.factoryProjectId)).toEqual(['project-a2']);
    // Not remembered: the retry runs it again.
    expect(deps.recentKeys.size).toBe(0);

    await expect(handleLinearConnectEvent(delivery(issueWebhook()), deps)).resolves.toBe('dispatched');
  });
});

describe('PlatformLinearIntegration through the Connect event poller', () => {
  /** Appends a webhook to a connection's platform event log, as the platform's Linear route does for a migrated workspace. */
  function logWebhook(
    fake: FakeLinear,
    connectionId: string,
    event: { id: string; sourceEventId: string; payload: unknown },
  ): void {
    const log = fake.platform.connectionEvents.get(connectionId) ?? [];
    log.push({
      id: event.id,
      timestamp: Date.now(),
      integrationId: 'linear',
      eventType: 'Issue.update',
      sourceEventId: event.sourceEventId,
      payload: event.payload,
    });
    fake.platform.connectionEvents.set(connectionId, log);
  }

  /** Reads of a connection's event log the poller made. */
  function eventReads(fake: FakeLinear, connectionId: string): number {
    return fake.platform.requests.filter(r => r.path === `/v2/connections/${connectionId}/events`).length;
  }

  async function seedCard() {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    await seeded.workItems.upsert({
      orgId: project.orgId,
      userId: project.createdBy,
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'linear',
          type: 'issue',
          externalId: 'linear:ENG-42',
          url: 'https://linear.app/acme/issue/ENG-42',
        },
        title: 'ENG-42: Fix intake',
        stages: ['planning'],
        sessions: {},
        metadata: { linearIssueId: 'issue-1', linearStateType: 'unstarted' },
      },
    });
    const context = {
      storage: { projects: seeded.projects },
      runtime: { configVersion: 'test-v1', workItems: seeded.workItems, boards: createBoardRegistry() },
    } as unknown as IntegrationContext;
    return { context };
  }

  /** The integration with a rule that records the issues it observes, and the poller with its route. */
  async function start(fake: FakeLinear) {
    const { context } = await seedCard();
    const observed: Array<{ title: string; state: string; tracked: boolean }> = [];
    const linear = new PlatformLinearIntegration({
      connect: fake.platform.connect(),
      rules: {
        issueObserved: (rule: FactoryLinearRuleContext) => {
          observed.push({ title: rule.issue.title, state: rule.issue.state, tracked: Boolean(rule.item) });
        },
      },
    });
    // Registered at boot, whether or not any workspace is migrated yet.
    const route = linear.connectEventRoute(context);
    expect(route).not.toBeNull();
    let saved: unknown = null;
    const worker = new PlatformConnectEventPoller({
      storage: {
        integrationId: 'platform-connect-event-poller',
        settings: {
          get: async () => saved,
          save: async (_o: string, _u: string, next: unknown) => void (saved = next),
        },
      } as unknown as PlatformConnectEventPollerStorage,
      routes: [route!],
      intervalMs: 20,
      retryDelayMs: 5,
    });
    await worker.init({
      pubsub: {},
      storage: {},
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    } as unknown as WorkerDeps);
    await worker.start();
    onTestFinished(async () => {
      await worker.stop();
      linear.migration.stop();
    });
    return { linear, observed, route: route! };
  }

  it("routes a linear event to Linear's handler, which updates the tracked card", async () => {
    const fake = await startFakeLinear();
    const connectionId = fake.connect(linearWorkspace());
    const { observed } = await start(fake);
    // The poller starts a connection it hasn't read before at the present moment.
    await vi.waitFor(() => expect(eventReads(fake, connectionId)).toBeGreaterThan(0));

    logWebhook(fake, connectionId, {
      id: `${Date.now() + 1}-0`,
      sourceEventId: 'delivery-1',
      payload: issueWebhook({ title: 'Fix intake (renamed)' }),
    });

    await vi.waitFor(() =>
      expect(observed).toEqual([{ title: 'Fix intake (renamed)', state: 'In Progress', tracked: true }]),
    );
  });

  it('handles the first event of a workspace migrated after boot, without a restart', async () => {
    const fake = await startFakeLinear();
    fake.addLegacy(linearWorkspace());
    const { linear, observed } = await start(fake);
    // Prime the connection listing before migration: the worker must not trust a stale one.
    expect(await linear.listWorkspaces()).toEqual([]);

    await linear.migration.run('admin');
    const [connection] = await linear.listConnections();
    expect(connection?.integrationId).toBe('linear');

    await vi.waitFor(() => expect(eventReads(fake, connection!.id)).toBeGreaterThan(0));
    logWebhook(fake, connection!.id, {
      id: `${Date.now() + 1}-0`,
      sourceEventId: 'delivery-after-migration',
      payload: issueWebhook({ title: 'Fix intake after migration' }),
    });

    await vi.waitFor(() =>
      expect(observed).toEqual([{ title: 'Fix intake after migration', state: 'In Progress', tracked: true }]),
    );
  });

  it('counts unverified events it drops in diagnostics', async () => {
    const fake = await startFakeLinear();
    const connectionId = fake.connect(linearWorkspace());
    const { linear, observed, route } = await start(fake);

    // The platform event log carries no verification flag, so the route is handed the delivery directly.
    await route.handle(delivery(issueWebhook(), { connectionId, unverified: true }));

    expect(linear.diagnostics()).toMatchObject({ unverifiedEventsDropped: 1 });
    expect(observed).toEqual([]);
  });
});
