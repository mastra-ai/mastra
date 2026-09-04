import { randomUUID } from 'node:crypto';

import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../../../storage/domains/work-items/base.js';
import type { IssueReconciler } from '../../issue-reconciler.js';
import type { LinearIssueIngress, LinearRulesIngress } from '../../linear/rules.js';
import { PlatformApiClient, PlatformApiError } from '../api-client.js';

const API_PREFIX = '/v1/server/linear';
const DEFAULT_POLL_INTERVAL_MS = 20_000;
const DEFAULT_RECONCILE_INTERVAL_MS = 5 * 60_000;
const EVENT_PAGE_SIZE = 500;
const MIN_LEASE_TTL_MS = 30_000;
const CURSOR_ORG_ID = '__platform_linear_event_worker__';
const CURSOR_USER_ID = 'worker';
const LEASE_KEY = 'platform-linear-events:linear';

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

/**
 * Minimal envelope shape mirrored from `@platform/linear`. Kept opaque
 * (`data: unknown`) — every consumer demuxes by `type`.
 */
export interface LinearWebhookEnvelope {
  type: string;
  action: string | null;
  createdAt: string | null;
  webhookTimestamp: number | null;
  linearOrganizationId: string | null;
  oauthClientId: string | null;
  url: string | null;
  data: unknown;
}

export interface LinearEventLogEntry {
  id: string;
  timestamp: number;
  envelope: LinearWebhookEnvelope;
}

export interface PlatformLinearWorkspace {
  linearWorkspaceId: string;
  linearWorkspaceName?: string;
}

/**
 * Everything the worker needs to drive ingest + reconciliation without
 * pulling in the full `PlatformLinearIntegration` type (circular).
 */
export interface PlatformLinearEventDispatchIntegration {
  listWorkspaces(): Promise<PlatformLinearWorkspace[]>;
}

export interface PlatformLinearEventWorkerConfig {
  client: PlatformApiClient;
  linear: PlatformLinearEventDispatchIntegration;
  storage: PlatformLinearEventStorage;
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  /**
   * Used to scope event dispatch to `(orgId, factoryProjectId)` pairs that
   * already have a work item linked to the incoming Linear issue. Without
   * this scoping, a workspace-scoped event would fan out to every project in
   * every org and materialize a triage card in each — a cross-tenant leak.
   * First-observation of a Linear issue happens through the user-authenticated
   * `/web/linear/issues?factoryProjectId=...` intake path instead.
   */
  workItems: Pick<WorkItemsStorage, 'list'>;
  /** Called with a single-issue rules ingress derived from an `Issue` webhook. */
  ingestFactoryIssue?: (input: LinearRulesIngress) => Promise<unknown>;
  reconcileFactoryState?: IssueReconciler;
  /** When false the worker skips event tailing and only runs the reconcile sweep. */
  pollEventsEnabled?: boolean;
  intervalMs?: number;
  reconcileIntervalMs?: number;
  now?: () => number;
}

/**
 * Tails the Platform Linear event stream (Redis-backed, per workspace) and
 * runs the same folded issue-reconcile sweep pattern as
 * `PlatformGithubEventWorker`. Issue events are translated into a normal
 * `LinearRulesIngress` so downstream rule dispatch is identical to the
 * polling path.
 *
 * Cursor state is persisted per workspace via the integration's generic
 * settings surface, keyed by a well-known worker identity. Cold start uses
 * `afterTimestamp: now - 1` to avoid replaying the 14-day stream backlog.
 *
 * ## Delivery semantics
 *
 * **At-most-once** per event. The cursor advances to the last event ID in a
 * page after all dispatch attempts on that page complete, regardless of
 * whether individual ingest calls threw. Ingest failures are logged, the
 * offending event is not retried, and drift is caught by the folded
 * `LinearIssueReconciler` sweep on its own cadence (default 5 minutes). This
 * matches `PlatformGithubEventWorker` and avoids poison-pill events blocking
 * the whole stream. Any consumer that needs exactly-once must idempotently
 * handle the same issue arriving via both the event path and the reconcile
 * path.
 */
export class PlatformLinearEventWorker extends MastraWorker {
  readonly name = 'platform-linear-events';

  readonly #client: PlatformApiClient;
  readonly #linear: PlatformLinearEventDispatchIntegration;
  readonly #storage: PlatformLinearEventStorage;
  readonly #projects: Pick<FactoryProjectsStorage, 'listAll'>;
  readonly #workItems: Pick<WorkItemsStorage, 'list'>;
  readonly #ingestFactoryIssue: ((input: LinearRulesIngress) => Promise<unknown>) | undefined;
  readonly #reconcileFactoryState: IssueReconciler | undefined;
  readonly #pollEventsEnabled: boolean;
  readonly #intervalMs: number;
  readonly #reconcileIntervalMs: number;
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
  #lastReconcileAt = 0;
  #settings: PlatformLinearEventWorkerSettings = { version: 1, workspaces: {} };

  constructor(config: PlatformLinearEventWorkerConfig) {
    super();
    this.#client = config.client;
    this.#linear = config.linear;
    this.#storage = config.storage;
    this.#projects = config.projects;
    this.#workItems = config.workItems;
    this.#ingestFactoryIssue = config.ingestFactoryIssue;
    this.#reconcileFactoryState = config.reconcileFactoryState;
    this.#pollEventsEnabled = config.pollEventsEnabled ?? true;
    this.#intervalMs = config.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.#reconcileIntervalMs = config.reconcileIntervalMs ?? DEFAULT_RECONCILE_INTERVAL_MS;
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('Platform Linear event polling interval must be a positive number.');
    }
    if (!Number.isFinite(this.#reconcileIntervalMs) || this.#reconcileIntervalMs <= 0) {
      throw new Error('Platform Linear reconcile interval must be a positive number.');
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
      await this.#leaseProvider.releaseLease(LEASE_KEY, this.#leaseOwner).catch(() => undefined);
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
    let nextDelay = this.#intervalMs;
    try {
      if (!(await this.#ensureLease())) return;
      nextDelay = await this.#poll();
    } catch (error) {
      nextDelay = retryDelay(error, this.#intervalMs);
      this.deps?.logger.error('Platform Linear event polling cycle failed', {
        error: error instanceof Error ? error.message : String(error),
        retryInMs: nextDelay,
      });
    } finally {
      this.#schedule(nextDelay);
    }
  }

  async #ensureLease(): Promise<boolean> {
    if (this.#hasLease) return true;
    const result = await this.#leaseProvider.acquireLease(LEASE_KEY, this.#leaseOwner, this.#leaseTtlMs);
    this.#hasLease = result.acquired;
    if (this.#hasLease) this.#startLeaseRenewal();
    return this.#hasLease;
  }

  #startLeaseRenewal(): void {
    if (this.#leaseRenewalTimer) return;
    this.#leaseRenewalTimer = setInterval(
      () => {
        void this.#leaseProvider
          .renewLease(LEASE_KEY, this.#leaseOwner, this.#leaseTtlMs)
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

  async #poll(): Promise<number> {
    // Reconcile-only mode has no event tail to keep fresh, so tick on the
    // slower reconcile cadence instead of the polling interval.
    let retryInMs = this.#pollEventsEnabled ? this.#intervalMs : this.#reconcileIntervalMs;

    if (this.#pollEventsEnabled) {
      // Only list workspaces when actually tailing events: reconciliation
      // does not need the workspace list, and folding this call into
      // reconcile-only mode would let one workspace-listing outage take
      // down the reconcile sweep as well.
      let workspaces: PlatformLinearWorkspace[] = [];
      try {
        workspaces = await this.#linear.listWorkspaces();
      } catch (error) {
        const delay = retryDelay(error, this.#intervalMs);
        retryInMs = Math.max(retryInMs, delay);
        this.deps?.logger.error('Platform Linear workspace listing failed', {
          error: error instanceof Error ? error.message : String(error),
          retryInMs: delay,
        });
      }

      for (const workspace of workspaces) {
        if (!this.#running || !this.#hasLease) break;
        try {
          await this.#pollWorkspace(workspace.linearWorkspaceId);
        } catch (error) {
          const delay = retryDelay(error, this.#intervalMs);
          retryInMs = Math.max(retryInMs, delay);
          this.deps?.logger.error('Platform Linear workspace event polling failed', {
            linearWorkspaceId: workspace.linearWorkspaceId,
            error: error instanceof Error ? error.message : String(error),
            retryInMs: delay,
          });
          if (error instanceof PlatformApiError && error.status === 429) break;
        }
      }
    }

    await this.#maybeReconcile();

    return retryInMs;
  }

  async #maybeReconcile(): Promise<void> {
    if (!this.#reconcileFactoryState || !this.#running || !this.#hasLease) return;
    const now = this.#now();
    if (now - this.#lastReconcileAt < this.#reconcileIntervalMs) return;
    // Advance the clock before sweeping so a persistently failing sweep stays
    // on cadence instead of retrying every poll tick.
    this.#lastReconcileAt = now;
    const startedAt = Date.now();
    try {
      const { errors, ...counts } = await this.#reconcileFactoryState();
      const context = { ...counts, durationMs: Date.now() - startedAt };
      if (counts.failed > 0) {
        this.deps?.logger.warn('Platform Linear issue reconcile sweep completed with failures', {
          ...context,
          errors,
        });
      } else if (counts.updated > 0) {
        this.deps?.logger.info('Platform Linear issue reconcile patched stale metadata', context);
      } else {
        this.deps?.logger.debug('Platform Linear issue reconcile sweep completed', context);
      }
    } catch (error) {
      this.deps?.logger.error('Platform Linear issue reconcile failed', {
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async #pollWorkspace(linearWorkspaceId: string): Promise<void> {
    if (!this.#settings.workspaces[linearWorkspaceId]) {
      this.#settings.workspaces[linearWorkspaceId] = { afterTimestamp: this.#startedAt };
      await this.#saveSettings();
    }

    while (this.#running && this.#hasLease) {
      const cursor: EventCursor = this.#settings.workspaces[linearWorkspaceId]!;
      const query = new URLSearchParams({ limit: String(EVENT_PAGE_SIZE), type: 'Issue' });
      if ('afterEventId' in cursor) query.set('afterEventId', cursor.afterEventId);
      else query.set('after', String(cursor.afterTimestamp));

      const pollStartedAt = performance.now();
      const page = await this.#client.request<{ events: LinearEventLogEntry[] }>(
        'GET',
        `${API_PREFIX}/workspaces/${encodeURIComponent(linearWorkspaceId)}/events?${query}`,
      );
      this.deps?.logger.debug('Platform Linear workspace event poll completed', {
        linearWorkspaceId,
        eventCount: page.events.length,
        latencyMs: Math.round(performance.now() - pollStartedAt),
      });
      if (page.events.length === 0) return;

      const lastId = page.events[page.events.length - 1]!.id;

      // Resolve the project set once per page instead of once per event.
      // The event stream can return up to EVENT_PAGE_SIZE (500) events; the
      // project list rarely changes within the second or two it takes to
      // dispatch a single page, and #dispatchEvent still consults storage
      // per-project to check for a linked work item.
      const projects = await this.#projects.listAll();

      for (const event of page.events) {
        if (!this.#running || !this.#hasLease) return;
        await this.#dispatchEvent(linearWorkspaceId, event, projects);
      }

      if ('afterEventId' in cursor && cursor.afterEventId === lastId) return;
      this.#settings.workspaces[linearWorkspaceId] = { afterEventId: lastId };
      await this.#saveSettings();

      // Short pages mean we've caught up; wait for the next tick.
      if (page.events.length < EVENT_PAGE_SIZE) return;
    }
  }

  async #dispatchEvent(
    linearWorkspaceId: string,
    event: LinearEventLogEntry,
    projects: readonly { id: string; orgId: string }[],
  ): Promise<void> {
    if (event.envelope.type !== 'Issue') return;
    if (!this.#ingestFactoryIssue) return;
    const issue = parseIssueEnvelope(event.envelope);
    if (!issue) {
      this.deps?.logger.warn('Platform Linear event log returned an unusable Issue payload', {
        linearWorkspaceId,
        eventId: event.id,
      });
      return;
    }

    // The event stream is workspace-scoped and Platform Linear has no
    // workspace→org mapping we can trust. To avoid cross-tenant fan-out (an
    // Issue from org A materializing a triage card in org B via the default
    // `linearIssueObserved` rule), only dispatch to `(orgId, factoryProjectId)`
    // pairs that already have a persisted work item for this Linear issue.
    // First-observation of a Linear issue happens through the
    // user-authenticated `/web/linear/issues?factoryProjectId=...` intake path.
    const sourceKey = `linear:${issue.identifier}`;
    let dispatched = 0;
    for (const project of projects) {
      let items;
      try {
        items = await this.#workItems.list({ orgId: project.orgId, factoryProjectId: project.id });
      } catch (error) {
        this.deps?.logger.error('Platform Linear work-item lookup failed', {
          linearWorkspaceId,
          eventId: event.id,
          projectId: project.id,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      const linked = items.some(
        item =>
          item.externalSource?.integrationId === 'linear' &&
          item.externalSource.type === 'issue' &&
          item.externalSource.externalId === sourceKey,
      );
      if (!linked) continue;
      try {
        await this.#ingestFactoryIssue({
          orgId: project.orgId,
          userId: 'platform-linear-event-worker',
          factoryProjectId: project.id,
          issues: [issue],
        });
        dispatched += 1;
      } catch (error) {
        this.deps?.logger.error('Platform Linear issue ingest failed', {
          linearWorkspaceId,
          eventId: event.id,
          projectId: project.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (dispatched === 0) {
      this.deps?.logger.debug('Platform Linear Issue event had no linked work items to update', {
        linearWorkspaceId,
        eventId: event.id,
        sourceKey,
      });
    }
  }

  async #saveSettings(): Promise<void> {
    await this.#storage.settings.save(CURSOR_ORG_ID, CURSOR_USER_ID, this.#settings);
  }
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

/**
 * Translate an Issue webhook envelope into the rules-ingress shape.
 * Returns undefined when the payload lacks the identifiers we need to
 * match a work item.
 */
function parseIssueEnvelope(envelope: LinearWebhookEnvelope): LinearIssueIngress | undefined {
  const data = envelope.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const raw = data as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : undefined;
  const identifier = typeof raw.identifier === 'string' ? raw.identifier : undefined;
  const title = typeof raw.title === 'string' ? raw.title : undefined;
  const url = typeof raw.url === 'string' ? raw.url : envelope.url ?? undefined;
  if (!id || !identifier || !title || !url) return undefined;

  const state = optionalObject(raw.state);
  const team = optionalObject(raw.team);
  const assignee = optionalObject(raw.assignee);
  const creator = optionalObject(raw.user) ?? optionalObject(raw.creator);
  const labels = Array.isArray(raw.labels)
    ? raw.labels.flatMap(label => {
        const obj = optionalObject(label);
        return obj && typeof obj.name === 'string' ? [obj.name] : [];
      })
    : [];

  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : envelope.createdAt ?? '';
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;

  return {
    id,
    identifier,
    title,
    url,
    state: (state && typeof state.name === 'string' ? state.name : null) ?? '',
    stateType: (state && typeof state.type === 'string' ? state.type : null) ?? '',
    priorityLabel: typeof raw.priorityLabel === 'string' ? raw.priorityLabel : '',
    assignee: assignee && typeof assignee.name === 'string' ? assignee.name : null,
    creator: creator && typeof creator.name === 'string' ? creator.name : null,
    team: team && typeof team.name === 'string' ? team.name : null,
    labels,
    createdAt,
    updatedAt,
  };
}

function optionalObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}
