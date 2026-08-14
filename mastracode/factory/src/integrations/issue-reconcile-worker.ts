import { randomUUID } from 'node:crypto';

import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type { IssueReconciler } from './issue-reconciler.js';

export const DEFAULT_ISSUE_RECONCILE_INTERVAL_MS = 5 * 60_000;
const MIN_LEASE_TTL_MS = 30_000;

export interface IssueReconcileWorkerConfig {
  integrationId: string;
  reconcile: IssueReconciler;
  intervalMs?: number;
}

export class IssueReconcileWorker extends MastraWorker {
  readonly name: string;

  readonly #integrationId: string;
  readonly #reconcile: IssueReconciler;
  readonly #intervalMs: number;
  readonly #leaseTtlMs: number;
  readonly #leaseKey: string;
  readonly #leaseOwner = randomUUID();

  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #inFlight: Promise<void> | undefined;
  #leaseProvider: LeaseProvider = NoopLeaseProvider;

  constructor(config: IssueReconcileWorkerConfig) {
    super();
    this.#integrationId = config.integrationId;
    this.name = `${config.integrationId}-issue-reconcile`;
    this.#leaseKey = `${config.integrationId}:issue-reconcile`;
    this.#reconcile = config.reconcile;
    this.#intervalMs = config.intervalMs ?? DEFAULT_ISSUE_RECONCILE_INTERVAL_MS;
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error(`${config.integrationId} issue reconcile interval must be a positive number.`);
    }
    this.#leaseTtlMs = Math.max(MIN_LEASE_TTL_MS, this.#intervalMs * 3);
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
    this.#leaseProvider = getLeaseProvider(deps.pubsub);
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('IssueReconcileWorker: call init() before start()');
    this.#running = true;
    this.deps.logger.info(`${this.#integrationId} issue reconcile worker started`, { intervalMs: this.#intervalMs });
    this.#schedule(0);
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
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
      const run = this.#tick().finally(() => {
        this.#inFlight = undefined;
        this.#schedule(this.#intervalMs);
      });
      this.#inFlight = run;
    }, delayMs);
    this.#timer.unref?.();
  }

  async #tick(): Promise<void> {
    const lease = await this.#leaseProvider
      .acquireLease(this.#leaseKey, this.#leaseOwner, this.#leaseTtlMs)
      .catch(() => ({ acquired: false }));
    if (!lease.acquired) return;

    // A sweep that traverses many projects/orgs can outrun the lease TTL;
    // renew periodically so a replica can't grab the expired lease and start
    // an overlapping sweep partway through this one.
    const renewalTimer = setInterval(
      () => {
        void this.#leaseProvider
          .renewLease(this.#leaseKey, this.#leaseOwner, this.#leaseTtlMs)
          .catch(error => {
            this.deps?.logger.warn(`${this.#integrationId} issue reconcile lease renewal failed`, {
              error: error instanceof Error ? error.message : String(error),
            });
          });
      },
      Math.max(1_000, Math.floor(this.#leaseTtlMs / 3)),
    );
    renewalTimer.unref?.();

    try {
      const startedAt = Date.now();
      const { errors, ...counts } = await this.#reconcile();
      const context = { ...counts, durationMs: Date.now() - startedAt };
      if (counts.failed > 0) {
        this.deps?.logger.warn(`${this.#integrationId} issue reconcile sweep completed with failures`, {
          ...context,
          errors,
        });
      } else {
        this.deps?.logger.debug(`${this.#integrationId} issue reconcile sweep completed`, context);
      }
    } catch (error) {
      this.deps?.logger.warn(`${this.#integrationId} issue reconcile sweep failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearInterval(renewalTimer);
      await this.#leaseProvider.releaseLease(this.#leaseKey, this.#leaseOwner).catch(() => undefined);
    }
  }
}

function getLeaseProvider(pubsub: PubSub): LeaseProvider {
  const getProvider = (pubsub as PubSub & { getLeaseProvider?: () => LeaseProvider | undefined }).getLeaseProvider;
  if (typeof getProvider === 'function') return getProvider.call(pubsub) ?? NoopLeaseProvider;
  return isLeaseProvider(pubsub)
    ? pubsub
    : ((pubsub as PubSub & { lease?: LeaseProvider }).lease ?? NoopLeaseProvider);
}
