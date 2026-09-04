import { MastraWorker } from '@mastra/core/worker';

import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { FactorySupervisorFindingRecord, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { runFactoryHealthCheck } from './health.js';
import type { NotifySupervisorInput } from './notify.js';
import { isSupervisorFindingVisibleToHumans } from './visibility.js';

export const DEFAULT_SUPERVISOR_HEALTH_INTERVAL_MS = 5 * 60_000;
/** Un-notified findings emitted per storage read during a sweep's drain. */
export const EMIT_PAGE_SIZE = 100;

export class FactorySupervisorHealthWorker extends MastraWorker {
  readonly name = 'factory-supervisor-health';

  readonly #projects: FactoryProjectsStorage;
  readonly #workItems: WorkItemsStorage;
  readonly #intervalMs: number;
  readonly #notify: ((input: NotifySupervisorInput) => Promise<void>) | undefined;
  readonly #attentionChanged: ((scope: { orgId: string; factoryProjectId: string }) => void) | undefined;
  #running = false;
  /** Per project, the instant of its last fully successful sweep: the backstop doorbell compares against it. */
  readonly #sweptAt = new Map<string, Date>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #inFlight: Promise<void> | undefined;

  constructor(input: {
    projects: FactoryProjectsStorage;
    workItems: WorkItemsStorage;
    intervalMs?: number;
    /** Emits one supervisor notification per un-notified open finding. Optional so tests can construct the worker without wiring the controller. */
    notify?: (input: NotifySupervisorInput) => Promise<void>;
    /**
     * Announces that a project's Attention projection changed without a row
     * write: the force-surface backstop flips a hidden finding visible purely
     * by wall-clock age, and connected Attention streams stop polling, so the
     * sweep rings the same doorbell storage writes do.
     */
    attentionChanged?: (scope: { orgId: string; factoryProjectId: string }) => void;
  }) {
    super();
    this.#projects = input.projects;
    this.#workItems = input.workItems;
    this.#intervalMs = input.intervalMs ?? DEFAULT_SUPERVISOR_HEALTH_INTERVAL_MS;
    this.#notify = input.notify;
    this.#attentionChanged = input.attentionChanged;
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('FactorySupervisorHealthWorker: call init() before start()');
    this.#running = true;
    this.#schedule(0);
  }

  async stop(): Promise<void> {
    this.#running = false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    await this.#inFlight;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  #schedule(delayMs: number): void {
    if (!this.#running) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#inFlight = this.#tick()
        .catch(error => this.deps?.logger.error('Factory supervisor health sweep failed', { error }))
        .finally(() => {
          this.#inFlight = undefined;
          this.#schedule(this.#intervalMs);
        });
    }, delayMs);
    this.#timer.unref?.();
  }

  async #tick(): Promise<void> {
    const now = new Date();
    const projects = await this.#projects.listAll();
    const concurrency = 4;
    let nextIndex = 0;
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(concurrency, projects.length) }, async () => {
        while (nextIndex < projects.length) {
          const project = projects[nextIndex++];
          if (!project) return;
          const report = await runFactoryHealthCheck(
            this.#workItems,
            { orgId: project.orgId, factoryProjectId: project.id },
            { now },
          );
          await this.#workItems.syncSupervisorFindings({
            orgId: project.orgId,
            factoryProjectId: project.id,
            findings: report.findings,
            now,
          });
          await this.#emitUnnotified({ orgId: project.orgId, factoryProjectId: project.id });
          // Rows that crossed the backstop since this project's last SUCCESSFUL
          // sweep are the ones no write announced. The checkpoint only advances
          // once the whole sweep for the project landed, so a crossing during a
          // failed or abandoned tick still rings on the next good one. Before
          // the first sweep it is "since forever": already-stale rows get one
          // refresh after boot.
          const since = this.#sweptAt.get(project.id) ?? new Date(0);
          await this.#announceForceSurfaced({ orgId: project.orgId, factoryProjectId: project.id }, since, now);
          this.#sweptAt.set(project.id, now);
        }
      }),
    );
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failure) throw failure.reason;
  }

  /**
   * Emit for every open finding whose `last_notified_at` is null, then stamp.
   * The null-stamp rule alone covers newly opened rows, reopened rows (reopen
   * clears the stamp), and a crash between writing the row and emitting (row
   * persisted, stamp never happened). The stamp is occurrence-safe inside the
   * storage domain, so a resolve/reopen racing the send never suppresses the
   * new occurrence's notification. One failing emit is logged and skipped —
   * the un-stamped row retries on the next sweep.
   */
  async #emitUnnotified(scope: { orgId: string; factoryProjectId: string }): Promise<void> {
    if (!this.#notify) return;
    // Walk the un-notified rows once, oldest first, by keyset cursor: each
    // row is attempted at most once per sweep and a failing row never blocks
    // the rows behind it (it stays un-stamped and retries next sweep).
    let after: { openedAt: Date; id: string } | undefined;
    for (;;) {
      const rows = await this.#workItems.listUnnotifiedSupervisorFindings({
        ...scope,
        limit: EMIT_PAGE_SIZE,
        ...(after ? { after } : {}),
      });
      for (const row of rows) {
        try {
          await this.#notify({
            projectId: scope.factoryProjectId,
            findingKey: row.findingKey,
            kind: findingText(row, 'kind') ?? 'unknown',
            summary: findingText(row, 'evidence') ?? findingText(row, 'title') ?? row.findingKey,
          });
          await this.#workItems.markSupervisorFindingNotified({
            ...scope,
            findingKey: row.findingKey,
            occurrence: row.occurrence,
            notifiedAt: new Date(),
          });
        } catch (error) {
          this.deps?.logger.warn('Factory supervisor notify failed', {
            findingKey: row.findingKey,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      const last = rows[rows.length - 1];
      if (rows.length < EMIT_PAGE_SIZE || !last) return;
      after = { openedAt: last.openedAt, id: last.id };
    }
  }

  /**
   * Ring the Attention doorbell once if any open finding became visible to
   * humans purely by aging past the backstop since `since`. Uses
   * the one visibility predicate at both instants, so escalated and
   * human-facing rows (visible at both) never count and the hidden-kind set
   * is never restated here.
   */
  async #announceForceSurfaced(
    scope: { orgId: string; factoryProjectId: string },
    since: Date,
    now: Date,
  ): Promise<void> {
    if (!this.#attentionChanged) return;
    let before: { occurredAt: Date; id: string } | undefined;
    for (;;) {
      const { rows, hasMore } = await this.#workItems.listSupervisorFindingPage({
        ...scope,
        limit: EMIT_PAGE_SIZE,
        ...(before ? { before } : {}),
      });
      const crossed = rows.some(
        row => isSupervisorFindingVisibleToHumans(row, now) && !isSupervisorFindingVisibleToHumans(row, since),
      );
      if (crossed) {
        this.#attentionChanged(scope);
        return;
      }
      const last = rows.at(-1);
      if (!hasMore || !last) return;
      before = { occurredAt: last.updatedAt, id: last.id };
    }
  }
}

function findingText(row: FactorySupervisorFindingRecord, key: string): string | undefined {
  const value = row.finding[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
