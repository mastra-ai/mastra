import type { Event } from '../../events/types';
import type { Mastra } from '../../mastra';
import type { ScheduleTarget } from '../../storage/domains/schedules/base';
import { PullTransport } from '../../worker/transport/pull-transport';
import type { WorkerTransport } from '../../worker/transport/transport';
import { MastraWorker } from '../../worker/worker';
import type { WorkerDeps } from '../../worker/worker';
import { createHeartbeatBroadcastProcessor } from './broadcast-processor';
import type { HeartbeatRunStatus } from './types';

/** PubSub topic on which the scheduler publishes `heartbeat.fire` events. */
export const TOPIC_HEARTBEATS = 'heartbeats';

const DEFAULT_GROUP = 'mastra-heartbeats';

export interface HeartbeatWorkerConfig {
  group?: string;
}

export interface HeartbeatFireEventData {
  scheduleId: string;
  claimId: string;
  scheduledFireAt: number;
  target: Extract<ScheduleTarget, { type: 'heartbeat' }>;
  /** Defaults to `'schedule-fire'`. `'manual'` for fire-now invocations. */
  triggerKind?: 'schedule-fire' | 'manual';
}

/**
 * Returns `true` when `nowMs` (UTC ms) falls inside the daily window
 * defined by `window.start` / `window.end` (HH:mm) in `window.timezone`
 * (defaults to UTC). When `start > end` the window wraps midnight.
 */
export function isWithinActiveHours(window: { start: string; end: string; timezone?: string }, nowMs: number): boolean {
  const tz = window.timezone ?? 'UTC';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(nowMs));
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  const nowMinutes = hour * 60 + minute;

  const [sh, sm] = window.start.split(':').map(Number);
  const [eh, em] = window.end.split(':').map(Number);
  const startMinutes = sh! * 60 + sm!;
  const endMinutes = eh! * 60 + em!;

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Wrapped window (e.g. 22:00 -> 06:00)
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

/**
 * Consumes `heartbeat.fire` events published by the scheduler and runs
 * the configured agent — either by `sendSignal` (threaded) or
 * `agent.generate` (threadless). Mirrors `OrchestrationWorker`'s
 * subscribe-on-start / unsubscribe-on-stop lifecycle.
 *
 * Records the schedule trigger after dispatching so the trigger row
 * carries the agent's runId (not just the scheduler's claim id),
 * letting the UI link triggers to real agent runs.
 */
export class HeartbeatWorker extends MastraWorker {
  readonly name = 'heartbeat';

  #config: HeartbeatWorkerConfig;
  #transport?: WorkerTransport;
  #running = false;

  constructor(config: HeartbeatWorkerConfig = {}) {
    super();
    this.#config = config;
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);

    if (!deps.mastra) {
      throw new Error('HeartbeatWorker requires Mastra instance');
    }
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('HeartbeatWorker: call init() before start()');

    const group = this.#config.group ?? DEFAULT_GROUP;
    this.#transport = new PullTransport({
      pubsub: this.deps.pubsub,
      group,
      topic: TOPIC_HEARTBEATS,
      logger: this.deps.logger,
    });

    await this.#transport.start({
      route: (event, ack, nack) => this.#handleEvent(event, ack, nack),
    });

    this.#running = true;
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    try {
      if (this.#transport) {
        await this.#transport.stop();
        this.#transport = undefined;
      }
    } finally {
      this.#running = false;
    }
  }

  get isRunning(): boolean {
    return this.#running;
  }

  async #handleEvent(event: Event, ack?: () => Promise<void>, nack?: () => Promise<void>): Promise<void> {
    if (event.type !== 'heartbeat.fire') {
      // Not ours — ack and ignore.
      await ack?.();
      return;
    }

    const mastra = this.mastra!;
    const payload = event.data as HeartbeatFireEventData;
    try {
      await this.#dispatch(mastra, payload);
      await ack?.();
    } catch (err) {
      this.deps?.logger?.error('HeartbeatWorker: error processing heartbeat.fire', {
        scheduleId: payload?.scheduleId,
        claimId: payload?.claimId,
        error: err,
      });
      await nack?.();
    }
  }

  async #dispatch(mastra: Mastra, data: HeartbeatFireEventData): Promise<void> {
    const { scheduleId, claimId, scheduledFireAt, target } = data;
    const actualFireAt = Date.now();

    const result = await executeHeartbeat(mastra, scheduleId, target);

    await this.#recordTrigger({
      scheduleId,
      claimId,
      scheduledFireAt,
      actualFireAt,
      status: result.status,
      runId: result.runId,
      error: result.reason,
      triggerKind: data.triggerKind ?? 'schedule-fire',
    });
  }

  async #recordTrigger(args: {
    scheduleId: string;
    claimId: string;
    scheduledFireAt: number;
    actualFireAt: number;
    status: HeartbeatRunStatus;
    runId?: string;
    error?: string;
    triggerKind: 'schedule-fire' | 'manual';
  }): Promise<void> {
    const store = await this.deps?.storage.getStore('schedules');
    if (!store) return;
    try {
      await store.recordTrigger({
        scheduleId: args.scheduleId,
        runId: args.runId ?? args.claimId,
        scheduledFireAt: args.scheduledFireAt,
        actualFireAt: args.actualFireAt,
        outcome: deriveTriggerOutcome(args.status),
        error: args.error,
        triggerKind: args.triggerKind,
      });
    } catch (err) {
      this.deps?.logger?.error('HeartbeatWorker: failed to record trigger', {
        scheduleId: args.scheduleId,
        claimId: args.claimId,
        error: err,
      });
    }
  }
}

function deriveTriggerOutcome(status: HeartbeatRunStatus): 'published' | 'failed' {
  switch (status) {
    case 'agent-missing':
    case 'thread-missing':
    case 'invalid-input':
      return 'failed';
    default:
      return 'published';
  }
}

/**
 * Best-effort delete of the schedule row. Self-clean is best-effort —
 * an explicit `clearHeartbeat()` may have raced us. Swallow errors.
 */
async function selfClean(mastra: Mastra, scheduleId: string): Promise<void> {
  try {
    const store = await mastra.getStorage()?.getStore('schedules');
    if (!store) return;
    await store.deleteSchedule(scheduleId);
  } catch (error) {
    mastra.getLogger?.()?.debug?.('heartbeat self-clean failed', { scheduleId, error });
  }
}

/**
 * Resolves the agent, applies activeHours/idle filters, and either
 * `sendSignal`s into the target thread or runs `agent.generate`. The
 * returned `runId` is the agent run id from the SDK call (when a run
 * was actually started), suitable for trigger-row linkability.
 */
export async function executeHeartbeat(
  mastra: Mastra,
  scheduleId: string,
  target: Extract<ScheduleTarget, { type: 'heartbeat' }>,
): Promise<{ status: HeartbeatRunStatus; reason?: string; runId?: string }> {
  const { agentId, prompt, threadId, resourceId, activeHours, idleThresholdMs, broadcast } = target;
  const broadcastMode = broadcast ?? 'live';
  const broadcastProcessor = createHeartbeatBroadcastProcessor({ mode: broadcastMode, scheduleId, threadId });
  // Run-level marker carried on the signal / agent run so consumers (typing
  // status, UI badges, history renderers) can detect that this run was
  // heartbeat-driven even after loading from storage.
  const heartbeatRunMeta = {
    scheduleId,
    broadcast: broadcastMode,
    ...(threadId ? { threadId } : {}),
  };

  const agent = (() => {
    try {
      return mastra.getAgentById(agentId);
    } catch {
      return null;
    }
  })();
  if (!agent) {
    await selfClean(mastra, scheduleId);
    return { status: 'agent-missing', reason: `agent "${agentId}" no longer registered` };
  }

  if (activeHours && !isWithinActiveHours(activeHours, Date.now())) {
    return { status: 'skipped-outside-hours' };
  }

  if (threadId) {
    if (!resourceId) {
      return { status: 'invalid-input', reason: 'resourceId required when threadId is set' };
    }
    const memory = await agent.getMemory();
    if (memory) {
      const thread = await memory.getThreadById({ threadId });
      if (!thread) {
        await selfClean(mastra, scheduleId);
        return { status: 'thread-missing', reason: `thread "${threadId}" not found` };
      }
      if (idleThresholdMs !== undefined) {
        const updatedAt = thread.updatedAt instanceof Date ? thread.updatedAt.getTime() : Number(thread.updatedAt);
        if (Number.isFinite(updatedAt) && Date.now() - updatedAt < idleThresholdMs) {
          return { status: 'skipped-idle-threshold' };
        }
      }
    }

    const result = agent.sendSignal(
      {
        type: target.signalType ?? 'system-reminder',
        contents: prompt,
        providerOptions: { mastra: { heartbeat: heartbeatRunMeta } },
      },
      {
        resourceId,
        threadId,
        ifActive: { behavior: target.ifActive ?? 'discard' },
        ifIdle: {
          behavior: target.ifIdle ?? 'wake',
          streamOptions: {
            outputProcessors: [broadcastProcessor],
            providerOptions: { mastra: { heartbeat: heartbeatRunMeta } },
          },
        },
      },
    );
    return {
      status: 'signal-accepted',
      runId: extractRunId(result),
    };
  }

  const result = await agent.generate(prompt, {
    outputProcessors: [broadcastProcessor],
    providerOptions: { mastra: { heartbeat: heartbeatRunMeta } },
  });
  return {
    status: 'fired',
    runId: extractRunId(result),
  };
}

function extractRunId(value: unknown): string | undefined {
  if (value && typeof value === 'object' && 'runId' in value) {
    const runId = (value as { runId?: unknown }).runId;
    if (typeof runId === 'string') return runId;
  }
  return undefined;
}
