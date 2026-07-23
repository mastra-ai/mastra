import { randomUUID } from 'node:crypto';

import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type { IntakeStorage } from '../../../storage/domains/intake/base.js';
import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
import type { FactoryProject, FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import type { LinearIssueIngress } from '../../base.js';
import type { PlatformApiClient } from '../api-client.js';
import { PlatformApiError } from '../api-client.js';
import { decodeSourceId } from './source-id.js';

const API_PREFIX = '/v1/server/linear';
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const EVENT_PAGE_SIZE = 500;
const WORKSPACE_POLL_CONCURRENCY = 10;
const PROJECT_INGEST_CONCURRENCY = 10;
const MIN_LEASE_TTL_MS = 30_000;
const CURSOR_ORG_ID = '__platform_linear_event_worker__';
const CURSOR_USER_ID = 'worker';

type EventCursor = { afterEventId: string } | { afterTimestamp: number };
type PlatformLinearEventWorkerSettings = {
  version: 1;
  workspaces: Record<string, EventCursor>;
};

export type PlatformLinearEventStorage = IntegrationStorageHandle<
  Record<string, unknown>,
  PlatformLinearEventWorkerSettings,
  Record<string, unknown>
>;

type LinearEventLogEntry = {
  id: string;
  timestamp?: number;
  envelope: {
    type: string;
    action?: string | null;
    data?: unknown;
  };
};

type WorkspaceTarget = {
  key: string;
  orgId: string;
  workspaceId: string;
  projectIds: Set<string>;
};

type LinearIssueEvent = {
  issueId: string;
  projectId: string;
};

export interface PlatformLinearEventWorkerConfig {
  client: PlatformApiClient;
  intake: IntakeStorage;
  projects: FactoryProjectsStorage;
  storage: PlatformLinearEventStorage;
  loadIssue(workspaceId: string, issueId: string): Promise<LinearIssueIngress | null>;
  ingestLinearIssues(input: {
    orgId: string;
    userId: string;
    factoryProjectId: string;
    issues: LinearIssueIngress[];
  }): Promise<unknown>;
  intervalMs?: number;
  now?: () => number;
}

export class PlatformLinearEventWorker extends MastraWorker {
  readonly name = 'platform-linear-events';

  readonly #client: PlatformApiClient;
  readonly #intake: IntakeStorage;
  readonly #projects: FactoryProjectsStorage;
  readonly #storage: PlatformLinearEventStorage;
  readonly #loadIssue: PlatformLinearEventWorkerConfig['loadIssue'];
  readonly #ingestLinearIssues: PlatformLinearEventWorkerConfig['ingestLinearIssues'];
  readonly #intervalMs: number;
  readonly #now: () => number;
  readonly #leaseOwner = randomUUID();

  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #leaseRenewalTimer: ReturnType<typeof setInterval> | undefined;
  #inFlight: Promise<void> | undefined;
  #leaseProvider: LeaseProvider = NoopLeaseProvider;
  #leaseTtlMs: number;
  #hasLease = false;
  #startedAt = 0;
  #settings: PlatformLinearEventWorkerSettings = { version: 1, workspaces: {} };
  #settingsSaveQueue: Promise<void> = Promise.resolve();

  constructor(config: PlatformLinearEventWorkerConfig) {
    super();
    this.#client = config.client;
    this.#intake = config.intake;
    this.#projects = config.projects;
    this.#storage = config.storage;
    this.#loadIssue = config.loadIssue;
    this.#ingestLinearIssues = config.ingestLinearIssues;
    this.#intervalMs = config.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('Platform Linear event polling interval must be a positive number.');
    }
    this.#leaseTtlMs = Math.max(MIN_LEASE_TTL_MS, this.#intervalMs * 3);
    this.#now = config.now ?? Date.now;
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
    this.#leaseProvider = getLeaseProvider(deps.pubsub);
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('PlatformLinearEventWorker: call init() before start()');

    this.#startedAt = this.#now() - 1;
    this.#settings = normalizeSettings(await this.#storage.settings.get(CURSOR_ORG_ID, CURSOR_USER_ID));
    this.#running = true;
    this.deps.logger.info('Platform Linear event polling started', {
      intervalMs: this.#intervalMs,
      leaseTtlMs: this.#leaseTtlMs,
    });
    this.#schedule(0);
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#stopLeaseRenewal();
    await this.#inFlight;
    if (this.#hasLease) {
      await this.#leaseProvider.releaseLease(this.#leaseKey(), this.#leaseOwner).catch(() => undefined);
      this.#hasLease = false;
    }
  }

  get isRunning(): boolean {
    return this.#running;
  }

  #schedule(delayMs: number): void {
    if (!this.#running) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      const run = this.#tick();
      this.#inFlight = run;
      void run.finally(() => {
        if (this.#inFlight === run) this.#inFlight = undefined;
      });
    }, delayMs);
    this.#timer.unref?.();
  }

  async #tick(): Promise<void> {
    const cycleStartedAt = Date.now();
    let nextDelay = this.#intervalMs;
    let fixedCadence = true;
    try {
      if (!(await this.#ensureLease())) return;
      const result = await this.#poll();
      nextDelay = result.retryInMs;
      fixedCadence = !result.backoff;
    } catch (error) {
      nextDelay = retryDelay(error, this.#intervalMs);
      fixedCadence = false;
      this.deps?.logger.error('Platform Linear event polling cycle failed', {
        error: error instanceof Error ? error.message : String(error),
        retryInMs: nextDelay,
      });
    } finally {
      const durationMs = Math.max(0, Date.now() - cycleStartedAt);
      if (durationMs >= this.#intervalMs) {
        this.deps?.logger.warn('Platform Linear event polling cycle exceeded its interval', {
          event: 'platform_linear_event_poll_cycle_slow',
          durationMs,
          intervalMs: this.#intervalMs,
        });
      }
      this.#schedule(fixedCadence ? Math.max(0, nextDelay - durationMs) : nextDelay);
    }
  }

  async #ensureLease(): Promise<boolean> {
    if (this.#hasLease) return true;
    const result = await this.#leaseProvider.acquireLease(this.#leaseKey(), this.#leaseOwner, this.#leaseTtlMs);
    this.#hasLease = result.acquired;
    if (this.#hasLease) this.#startLeaseRenewal();
    return this.#hasLease;
  }

  #startLeaseRenewal(): void {
    if (this.#leaseRenewalTimer) return;
    this.#leaseRenewalTimer = setInterval(
      () => {
        void this.#leaseProvider
          .renewLease(this.#leaseKey(), this.#leaseOwner, this.#leaseTtlMs)
          .then(renewed => {
            if (!renewed) {
              this.#hasLease = false;
              this.#stopLeaseRenewal();
            }
          })
          .catch(error => {
            this.#hasLease = false;
            this.#stopLeaseRenewal();
            this.deps?.logger.warn('Platform Linear event polling lease renewal failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          });
      },
      Math.floor(this.#leaseTtlMs / 3),
    );
    this.#leaseRenewalTimer.unref?.();
  }

  #stopLeaseRenewal(): void {
    if (this.#leaseRenewalTimer) clearInterval(this.#leaseRenewalTimer);
    this.#leaseRenewalTimer = undefined;
  }

  async #poll(): Promise<{ retryInMs: number; backoff: boolean }> {
    const targets = await this.#discoverTargets();
    let retryInMs = this.#intervalMs;
    let backoff = false;
    let rateLimited = false;
    let settingsChanged = false;

    for (const target of targets) {
      if (this.#settings.workspaces[target.key]) continue;
      this.#settings.workspaces[target.key] = { afterTimestamp: this.#startedAt };
      settingsChanged = true;
    }
    if (settingsChanged) await this.#saveSettings();

    const projectsByOrg = new Map<string, Promise<FactoryProject[]>>();
    await forEachConcurrent(targets, WORKSPACE_POLL_CONCURRENCY, async target => {
      if (!this.#running || !this.#hasLease || rateLimited) return;
      try {
        let organizationProjects = projectsByOrg.get(target.orgId);
        if (!organizationProjects) {
          organizationProjects = this.#projects.list({ orgId: target.orgId });
          projectsByOrg.set(target.orgId, organizationProjects);
        }
        await this.#pollWorkspace(target, await organizationProjects);
      } catch (error) {
        const delay = retryDelay(error, this.#intervalMs);
        retryInMs = Math.max(retryInMs, delay);
        backoff = true;
        this.deps?.logger.error('Platform Linear workspace event polling failed', {
          organizationId: target.orgId,
          workspaceId: target.workspaceId,
          error: error instanceof Error ? error.message : String(error),
          retryInMs: delay,
        });
        if (error instanceof PlatformApiError && error.status === 429) rateLimited = true;
      }
    });

    return { retryInMs, backoff };
  }

  async #discoverTargets(): Promise<WorkspaceTarget[]> {
    const selections = await this.#intake.listEnabledSourceSelections('linear');
    const targets = new Map<string, WorkspaceTarget>();
    for (const selection of selections) {
      for (const sourceId of selection.sourceIds) {
        try {
          const source = decodeSourceId(sourceId);
          const key = workspaceKey(selection.orgId, source.workspaceId);
          const target = targets.get(key) ?? {
            key,
            orgId: selection.orgId,
            workspaceId: source.workspaceId,
            projectIds: new Set<string>(),
          };
          target.projectIds.add(source.projectId);
          targets.set(key, target);
        } catch (error) {
          this.deps?.logger.warn('Platform Linear intake selection contains an invalid source id', {
            organizationId: selection.orgId,
            sourceId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    return [...targets.values()];
  }

  async #pollWorkspace(target: WorkspaceTarget, factoryProjects: FactoryProject[]): Promise<void> {
    while (this.#running && this.#hasLease) {
      const cursor = this.#settings.workspaces[target.key]!;
      const query = new URLSearchParams({ limit: String(EVENT_PAGE_SIZE) });
      if ('afterEventId' in cursor) query.set('afterEventId', cursor.afterEventId);
      else query.set('after', String(cursor.afterTimestamp));

      const page = await this.#client.request<{ events: LinearEventLogEntry[] }>(
        'GET',
        `${API_PREFIX}/workspaces/${encodeURIComponent(target.workspaceId)}/events?${query}`,
      );
      if (page.events.length === 0) return;

      for (const event of page.events) {
        if (!this.#running || !this.#hasLease) return;
        const issueEvent = parseIssueEvent(event);
        if (!issueEvent || !target.projectIds.has(issueEvent.projectId)) continue;

        this.deps?.logger.info('Platform Linear event received from the Platform event log', {
          event: 'platform_linear_event_received',
          organizationId: target.orgId,
          workspaceId: target.workspaceId,
          eventId: event.id,
          linearEvent: event.envelope.type,
          action: event.envelope.action ?? null,
          ...(typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)
            ? { eventAgeMs: Math.max(0, Date.now() - event.timestamp) }
            : {}),
        });
        const issue = await this.#loadIssue(target.workspaceId, issueEvent.issueId);
        if (!issue) continue;

        await forEachConcurrent(factoryProjects, PROJECT_INGEST_CONCURRENCY, async project => {
          try {
            await this.#ingestLinearIssues({
              orgId: target.orgId,
              userId: project.createdBy,
              factoryProjectId: project.id,
              issues: [issue],
            });
          } catch (error) {
            this.deps?.logger.error('Platform Linear event ingestion failed for a Factory project', {
              organizationId: target.orgId,
              workspaceId: target.workspaceId,
              factoryProjectId: project.id,
              eventId: event.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });
      }

      const nextCursor = page.events.at(-1)?.id;
      if (!nextCursor || nextCursor === ('afterEventId' in cursor ? cursor.afterEventId : undefined)) return;
      this.#settings.workspaces[target.key] = { afterEventId: nextCursor };
      await this.#saveSettings();
      if (page.events.length < EVENT_PAGE_SIZE) return;
    }
  }

  async #saveSettings(): Promise<void> {
    const snapshot = structuredClone(this.#settings);
    const save = this.#settingsSaveQueue.then(() =>
      this.#storage.settings.save(CURSOR_ORG_ID, CURSOR_USER_ID, snapshot),
    );
    this.#settingsSaveQueue = save.catch(() => undefined);
    await save;
  }

  #leaseKey(): string {
    return `${this.name}:${this.#storage.integrationId}`;
  }
}

function parseIssueEvent(event: LinearEventLogEntry): LinearIssueEvent | null {
  if (!event.id || event.envelope.type !== 'Issue') return null;
  const data = event.envelope.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const issueId = Reflect.get(data, 'id');
  const projectId = Reflect.get(data, 'projectId');
  if (typeof issueId !== 'string' || !issueId || typeof projectId !== 'string' || !projectId) return null;
  return { issueId, projectId };
}

function workspaceKey(orgId: string, workspaceId: string): string {
  return `${orgId}:${workspaceId}`;
}

async function forEachConcurrent<T>(items: T[], concurrency: number, run: (item: T) => Promise<void>): Promise<void> {
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        if (item !== undefined) await run(item);
      }
    }),
  );
}

function getLeaseProvider(pubsub: PubSub): LeaseProvider {
  const getProvider = (pubsub as PubSub & { getLeaseProvider?: () => LeaseProvider | undefined }).getLeaseProvider;
  if (typeof getProvider === 'function') return getProvider.call(pubsub) ?? NoopLeaseProvider;
  return isLeaseProvider(pubsub) ? pubsub : NoopLeaseProvider;
}

function normalizeSettings(value: PlatformLinearEventWorkerSettings | null): PlatformLinearEventWorkerSettings {
  if (!value || value.version !== 1 || !value.workspaces || typeof value.workspaces !== 'object') {
    return { version: 1, workspaces: {} };
  }
  return { version: 1, workspaces: { ...value.workspaces } };
}

function retryDelay(error: unknown, fallbackMs: number): number {
  if (error instanceof PlatformApiError && error.status === 429 && error.retryAfterSeconds !== null) {
    return Math.max(fallbackMs, error.retryAfterSeconds * 1_000);
  }
  return fallbackMs;
}
