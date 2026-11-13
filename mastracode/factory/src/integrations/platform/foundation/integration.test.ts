import type { ApiRoute } from '@mastra/core/server';
import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type {
  CreatedIntakeComment,
  IntakeIssue,
  IntakeIssueDetail,
  IntakeIssuePage,
  IntakeItemPage,
  IntakeSource,
  ResolvedIntakeDispatch,
} from '../../../capabilities/intake.js';
import type { IntegrationContext } from '../../base.js';
import type { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import type { IssueReconcileSummary, IssueReconciler } from '../../issue-reconciler.js';
import { DEFAULT_VANTA_SYNC_INTERVAL_MS } from '../../vanta/sync.js';
import { PlatformIncidentioIntegration } from '../incidentio/integration.js';
import { PlatformJiraIntegration } from '../jira/integration.js';
import { PlatformVantaIntegration } from '../vanta/integration.js';
import type { PlatformConnection } from './connect-binding.js';
import { PlatformIntakeCapability } from './intake.js';
import { DEFAULT_PLATFORM_RECONCILE_INTERVAL_MS, PlatformConnectIntegration } from './integration.js';
import type { PlatformConnectIntegrationOptions } from './integration.js';
import { problem, startFakePlatform } from './test-utils.js';
import type { FakePlatform } from './test-utils.js';

const SUMMARY: IssueReconcileSummary = {
  projects: 0,
  checked: 0,
  updated: 0,
  closed: 0,
  missing: 0,
  failed: 0,
  errors: [],
};
const CTX = {} as IntegrationContext;
const OFFLINE = { baseUrl: 'http://127.0.0.1:9', accessToken: 'platform-secret', projectId: 'proj_factory' };

class TestIntegration extends PlatformConnectIntegration {
  readonly reconciler = vi.fn<IssueReconciler>(async () => SUMMARY);
  readonly #reconciles: boolean;

  constructor(options: Partial<PlatformConnectIntegrationOptions> & { reconciles?: boolean } = {}) {
    const { reconciles = true, ...rest } = options;
    super({ id: 'test', providerKeys: ['test-provider'], connect: OFFLINE, ...rest });
    this.#reconciles = reconciles;
  }

  protected override reconcile(): IssueReconciler | null {
    return this.#reconciles ? this.reconciler : null;
  }

  routes(): ApiRoute[] {
    return [];
  }
}

function workerDeps(): WorkerDeps {
  return {
    pubsub: {
      acquireLease: vi.fn(async () => ({ acquired: true })),
      releaseLease: vi.fn(async () => undefined),
      renewLease: vi.fn(async () => true),
      getLeaseOwner: vi.fn(async () => undefined),
      transferLease: vi.fn(async () => true),
    } as unknown as WorkerDeps['pubsub'],
    storage: {} as WorkerDeps['storage'],
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } as unknown as WorkerDeps['logger'],
  };
}

async function startWorker(integration: PlatformConnectIntegration): Promise<IssueReconcileWorker> {
  const [worker] = integration.workers(CTX) as IssueReconcileWorker[];
  if (!worker) throw new Error('expected a reconcile worker');
  await worker.init(workerDeps());
  await worker.start();
  onTestFinished(() => worker.stop());
  return worker;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('PlatformConnectIntegration reconcile worker', () => {
  it('reconciles hourly unless the integration or its operator says otherwise', () => {
    expect(new TestIntegration().reconcileIntervalMs).toBe(DEFAULT_PLATFORM_RECONCILE_INTERVAL_MS);
    expect(DEFAULT_PLATFORM_RECONCILE_INTERVAL_MS).toBe(60 * 60_000);
    expect(new TestIntegration({ reconcileDefaultIntervalMs: 900_000 }).reconcileIntervalMs).toBe(900_000);
    expect(
      new TestIntegration({ reconcileDefaultIntervalMs: 900_000, reconcileIntervalMs: 60_000 }).reconcileIntervalMs,
    ).toBe(60_000);
  });

  it('sweeps once at start, then on the interval', async () => {
    vi.useFakeTimers();
    const integration = new TestIntegration({ reconcileIntervalMs: 120_000 });
    const worker = await startWorker(integration);

    expect(worker.name).toBe('test-issue-reconcile');
    await vi.advanceTimersByTimeAsync(0);
    expect(integration.reconciler).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(119_999);
    expect(integration.reconciler).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(integration.reconciler).toHaveBeenCalledTimes(2);
  });

  it('has no worker when the integration has nothing to reconcile', () => {
    expect(new TestIntegration({ reconciles: false }).workers(CTX)).toEqual([]);
  });

  it('honors the integrations’ own defaults and their operator overrides', () => {
    // Jira and incident.io get their changes as events, so they only reconcile hourly.
    expect(new PlatformJiraIntegration({ connect: OFFLINE }).reconcileIntervalMs).toBe(
      DEFAULT_PLATFORM_RECONCILE_INTERVAL_MS,
    );
    expect(new PlatformIncidentioIntegration({ connect: OFFLINE }).reconcileIntervalMs).toBe(
      DEFAULT_PLATFORM_RECONCILE_INTERVAL_MS,
    );
    expect(new PlatformVantaIntegration({ connect: OFFLINE }).reconcileIntervalMs).toBe(DEFAULT_VANTA_SYNC_INTERVAL_MS);

    vi.stubEnv('MASTRACODE_JIRA_RECONCILE_INTERVAL_MS', '120000');
    vi.stubEnv('MASTRACODE_INCIDENT_IO_RECONCILE_INTERVAL_MS', '180000');
    expect(new PlatformJiraIntegration({ connect: OFFLINE }).reconcileIntervalMs).toBe(120_000);
    expect(new PlatformIncidentioIntegration({ connect: OFFLINE }).reconcileIntervalMs).toBe(180_000);
    expect(new PlatformVantaIntegration({ connect: OFFLINE, syncIntervalMs: 60_000 }).reconcileIntervalMs).toBe(60_000);
  });
});

describe('PlatformConnectIntegration linking', () => {
  async function platformWithOrgConnection(): Promise<FakePlatform> {
    const platform = await startFakePlatform();
    platform.orgConnections = [{ id: 'conn-1', integrationId: 'test-provider', status: 'active' }];
    return platform;
  }

  it('links existing org connections at boot when the integration opts in', async () => {
    const platform = await platformWithOrgConnection();
    const integration = new TestIntegration({ connect: platform.connect(), linkOrgConnectionsAtBoot: true });

    integration.workers(CTX);

    await expect(integration.listConnections()).resolves.toMatchObject([{ id: 'conn-1' }]);
    expect(platform.linked.has('conn-1')).toBe(true);
  });

  it('runs one extra reconcile when linking adds a connection', async () => {
    const platform = await platformWithOrgConnection();
    platform.linked.add('conn-1');
    const integration = new TestIntegration({ connect: platform.connect(), linkOrgConnectionsAtBoot: true });
    await startWorker(integration);
    await vi.waitFor(() => expect(integration.reconciler).toHaveBeenCalledTimes(1));

    platform.orgConnections.push({ id: 'conn-2', integrationId: 'test-provider', status: 'active' });
    await integration.linkOrgConnections();
    await vi.waitFor(() => expect(integration.reconciler).toHaveBeenCalledTimes(2));

    await integration.linkOrgConnections();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(integration.reconciler).toHaveBeenCalledTimes(2);
  });

  it('shows connections it could not link in diagnostics, and nothing when all are linked', async () => {
    const platform = await platformWithOrgConnection();
    platform.linkReplies.set('conn-1', problem(403, 'forbidden'));
    const integration = new TestIntegration({ connect: platform.connect() });
    expect(integration.diagnostics()).toEqual({ configured: true, mode: 'platform' });

    await integration.linkOrgConnections();

    expect(integration.diagnostics()).toEqual({
      configured: true,
      mode: 'platform',
      needsLinking: [{ connectionId: 'conn-1', reason: expect.stringContaining('integrations:write') }],
    });
  });

  it('registers its providers with the connect routes, sharing its connections', () => {
    const integration = new TestIntegration({
      connectProviders: [
        { provider: 'test', integrationId: 'test-provider' },
        { provider: 'test-legacy', integrationId: 'test-legacy', connectionIntegrationIds: ['test-legacy', 'test-v1'] },
      ],
    });

    expect(integration.platformConnectProviders()).toEqual([
      {
        provider: 'test',
        integrationId: 'test-provider',
        connectionIntegrationIds: ['test-provider'],
        binding: integration.binding,
      },
      {
        provider: 'test-legacy',
        integrationId: 'test-legacy',
        connectionIntegrationIds: ['test-legacy', 'test-v1'],
        binding: integration.binding,
      },
    ]);
  });
});

class TestIntake extends PlatformIntakeCapability {
  protected notConnectedError(connectionId: string): Error {
    return new Error(`not connected: ${connectionId}`);
  }

  lookup(connectionId: string): Promise<PlatformConnection> {
    return this.activeConnectionById(connectionId);
  }

  async resolveIntakeDispatch(): Promise<ResolvedIntakeDispatch | null> {
    return null;
  }
  async listSources(): Promise<IntakeSource[]> {
    return [];
  }
  async listItems(): Promise<IntakeItemPage> {
    return { items: [], nextCursor: null };
  }
  async listIssues(): Promise<IntakeIssuePage> {
    return { issues: [], nextCursor: null };
  }
  async getIssue(): Promise<IntakeIssueDetail | null> {
    return null;
  }
  async createComment(): Promise<CreatedIntakeComment | null> {
    return null;
  }
  async updateIssue(): Promise<IntakeIssue | null> {
    return null;
  }
}

describe('PlatformIntakeCapability', () => {
  it('carries a connection id through intake storage and back', () => {
    const intake = new TestIntake(new TestIntegration(), 'test-connection:');
    const credential = intake.connectionCredential('conn/1');

    expect(credential).toEqual({ type: 'oauth', accessToken: 'test-connection:conn/1' });
    expect(intake.connectionIdOf(credential)).toBe('conn/1');
  });

  it('does not read a connection id from tokens it did not mint', () => {
    const intake = new TestIntake(new TestIntegration(), 'test-connection:');
    const tokens: IntegrationConnection[] = [
      { type: 'oauth', accessToken: 'other-connection:conn-1' },
      { type: 'oauth', accessToken: 'test-connection:' },
      { type: 'oauth', accessToken: 'raw-provider-token' },
      { type: 'app-installation', installationId: 1 },
    ];

    for (const token of tokens) expect(intake.connectionIdOf(token)).toBeNull();
  });

  it('only resolves connection ids that name an active connection of the integration', async () => {
    const platform = await startFakePlatform();
    platform.orgConnections = [
      { id: 'conn-active', integrationId: 'test-provider', status: 'active' },
      { id: 'conn-reauth', integrationId: 'test-provider', status: 'needs_reauth' },
      { id: 'conn-other', integrationId: 'other-provider', status: 'active' },
    ];
    for (const connection of platform.orgConnections) platform.linked.add(connection.id);
    const intake = new TestIntake(new TestIntegration({ connect: platform.connect() }), 'test-connection:');

    await expect(intake.lookup('conn-active')).resolves.toMatchObject({ id: 'conn-active' });
    await expect(intake.lookup('conn-reauth')).rejects.toThrow('not connected: conn-reauth');
    await expect(intake.lookup('conn-other')).rejects.toThrow('not connected: conn-other');
    await expect(intake.lookup('conn-unknown')).rejects.toThrow('not connected: conn-unknown');
  });
});
