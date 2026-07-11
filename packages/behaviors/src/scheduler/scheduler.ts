import type { NormalizedBehaviorDefinition } from '../definition/types.js';
import type { BehaviorTransitionEngine } from '../runtime/transition-engine.js';
import type { BehaviorRuntimeStore, BehaviorThreadKey } from '../runtime/types.js';

export type BehaviorAuditEvent = {
  type: 'scheduler.claimed' | 'scheduler.completed' | 'scheduler.failed' | 'scheduler.skipped';
  at: string;
  threadId: string;
  behaviorId: string;
  checkpoint: string;
  detail?: string;
};

export type BehaviorSchedulerOptions = {
  behaviorId: string;
  definition: NormalizedBehaviorDefinition;
  store: BehaviorRuntimeStore;
  engine: BehaviorTransitionEngine;
  intervalMs?: number;
  leaseMs?: number;
  retryBackoffMs?: number;
  limit?: number;
  now?: () => Date;
  onAudit?: (event: BehaviorAuditEvent) => void | Promise<void>;
};

type Lease = { id: string; expiresAt: string };

export class BehaviorScheduler {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly now: () => Date;

  constructor(private readonly options: BehaviorSchedulerOptions) {
    this.now = options.now ?? (() => new Date());
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.options.intervalMs ?? 1_000);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const due = await this.options.store.listDue(this.now(), this.options.limit ?? 100);
      let completed = 0;
      for (const work of due) {
        if (work.behaviorId !== this.options.behaviorId) continue;
        if (await this.process(work)) completed += 1;
      }
      return completed;
    } finally {
      this.running = false;
    }
  }

  private async process(key: BehaviorThreadKey): Promise<boolean> {
    const now = this.now();
    const initial = await this.options.store.readThread(key);
    if (!initial) return false;
    const leaseId = crypto.randomUUID();
    const claim = await this.options.store.transactThread(key, current => {
      if (!current || current.status !== 'active' || !current.nextCheckAt || new Date(current.nextCheckAt) > now) {
        return { next: current ?? initial, result: undefined };
      }
      const existing = current.checkpoints.schedulerLease
        ? (JSON.parse(current.checkpoints.schedulerLease) as Lease)
        : undefined;
      if (existing && new Date(existing.expiresAt) > now) return { next: current, result: undefined };
      const checkpoint = current.nextCheckAt;
      return {
        next: {
          ...current,
          revision: current.revision + 1,
          checkpoints: {
            ...current.checkpoints,
            schedulerLease: JSON.stringify({
              id: leaseId,
              expiresAt: new Date(now.getTime() + (this.options.leaseMs ?? 30_000)).toISOString(),
            }),
            schedulerCheckpoint: checkpoint,
          },
        },
        result: { checkpoint, state: current.activeState },
      };
    });
    if (!claim.result) return false;
    const checkpoint = claim.result.checkpoint;
    await this.audit('scheduler.claimed', key, checkpoint);
    const state = this.options.definition.states[claim.result.state];
    const transitionId = state?.periodic?.transition;
    if (!transitionId) {
      await this.release(key, leaseId, checkpoint, 'Periodic transition is unavailable');
      return false;
    }
    try {
      await this.options.engine.transition({
        threadId: key.threadId,
        transitionId,
        attemptId: `periodic:${checkpoint}:${transitionId}`,
      });
      await this.complete(key, leaseId, checkpoint);
      await this.audit('scheduler.completed', key, checkpoint);
      return true;
    } catch (error) {
      await this.release(key, leaseId, checkpoint, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private async complete(key: BehaviorThreadKey, leaseId: string, checkpoint: string): Promise<void> {
    const initial = await this.options.store.readThread(key);
    if (!initial) return;
    await this.options.store.transactThread(key, current => {
      if (!current) return { next: initial, result: undefined };
      const lease = current.checkpoints.schedulerLease
        ? (JSON.parse(current.checkpoints.schedulerLease) as Lease)
        : undefined;
      if (lease?.id !== leaseId) return { next: current, result: undefined };
      const checkpoints: Record<string, string> = { ...current.checkpoints, schedulerCheckpoint: checkpoint };
      delete checkpoints.schedulerLease;
      return { next: { ...current, revision: current.revision + 1, checkpoints }, result: undefined };
    });
  }

  private async release(key: BehaviorThreadKey, leaseId: string, checkpoint: string, detail: string): Promise<void> {
    const initial = await this.options.store.readThread(key);
    if (!initial) return;
    await this.options.store.transactThread(key, current => {
      if (!current) return { next: initial, result: undefined };
      const lease = current.checkpoints.schedulerLease
        ? (JSON.parse(current.checkpoints.schedulerLease) as Lease)
        : undefined;
      if (lease?.id !== leaseId) return { next: current, result: undefined };
      const checkpoints = { ...current.checkpoints };
      delete checkpoints.schedulerLease;
      return {
        next: {
          ...current,
          revision: current.revision + 1,
          checkpoints,
          nextCheckAt: new Date(this.now().getTime() + (this.options.retryBackoffMs ?? 5_000)).toISOString(),
          audit: { ...current.audit, lastSchedulerError: detail, lastSchedulerCheckpoint: checkpoint },
        },
        result: undefined,
      };
    });
    await this.audit('scheduler.failed', key, checkpoint, detail);
  }

  private async audit(type: BehaviorAuditEvent['type'], key: BehaviorThreadKey, checkpoint: string, detail?: string) {
    await this.options.onAudit?.({ type, at: this.now().toISOString(), ...key, checkpoint, detail });
  }

}
