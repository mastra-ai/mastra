import type { Event, EventCallback } from '../../events/types';
import type { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import type { ScheduleTarget } from '../../storage/domains/schedules/base';
import { PullTransport } from '../../worker/transport/pull-transport';
import type { WorkerTransport } from '../../worker/transport/transport';
import { MastraWorker } from '../../worker/worker';
import type { WorkerDeps } from '../../worker/worker';
import type { AgentSignalIfIdleOptions } from '../types';
import type {
  HeartbeatEffective,
  HeartbeatHooks,
  HeartbeatIfIdle,
  HeartbeatPrepareContext,
  HeartbeatPrepareResult,
  HeartbeatRunStatus,
  HeartbeatTriggerInfo,
} from './types';

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
  #pushCb?: EventCallback;
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

    // Push-only pubsubs (EventEmitter, UnixSocketPubSub) don't support the
    // grouped pull subscription a PullTransport requires. They deliver every
    // event to every in-process subscriber, so subscribe directly without a
    // group — mirroring how Mastra.startWorkers handles workflow events for
    // push-only transports instead of running the pull-based worker.
    const modes = this.deps.pubsub.supportedModes ?? ['pull'];
    if (!modes.includes('pull')) {
      const cb: EventCallback = (event, ack, nack) => {
        void this.#handleEvent(event, ack, nack);
      };
      this.#pushCb = cb;
      await this.deps.pubsub.subscribe(TOPIC_HEARTBEATS, cb);
      this.#running = true;
      return;
    }

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
      if (this.#pushCb && this.deps) {
        await this.deps.pubsub.unsubscribe(TOPIC_HEARTBEATS, this.#pushCb);
        this.#pushCb = undefined;
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

    const result = await executeHeartbeat(mastra, scheduleId, target, {
      triggerKind: data.triggerKind ?? 'schedule-fire',
      firedAt: new Date(actualFireAt),
      logger: this.deps?.logger,
    });

    await this.#recordTrigger({
      scheduleId,
      claimId,
      scheduledFireAt,
      actualFireAt,
      outcome: result.outcome,
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
    outcome: HeartbeatTriggerOutcome;
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
        outcome: args.outcome,
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

/** Outcome union written to the schedule trigger row for a heartbeat fire. */
export type HeartbeatTriggerOutcome =
  | 'succeeded'
  | 'delivered'
  | 'persisted'
  | 'discarded'
  | 'skipped'
  | 'aborted'
  | 'failed';

/**
 * Best-effort delete of the schedule row. Self-clean is best-effort —
 * an explicit `heartbeats.delete()` may have raced us. Swallow errors.
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

type LooseLogger = { error?: (message: string, ...args: any[]) => void };

/** Optional context the `HeartbeatWorker` passes to `executeHeartbeat`. */
export interface ExecuteHeartbeatContext {
  triggerKind?: 'schedule-fire' | 'manual';
  firedAt?: Date;
  logger?: LooseLogger;
}

/**
 * Resolves the agent, runs the user `prepare` hook (if any), applies
 * idle filters, and either `sendSignal`s into the target
 * thread or runs `agent.generate`. The returned `runId` is the agent
 * run id from the SDK call (when a run was actually started), suitable
 * for trigger-row linkability.
 *
 * `outcome` is the final outcome for the schedule trigger row and is
 * also the one that drove the `onFinish`/`onError`/`onAbort` hook
 * selection. `status` is retained for back-compat with existing tests.
 */
export async function executeHeartbeat(
  mastra: Mastra,
  scheduleId: string,
  target: Extract<ScheduleTarget, { type: 'heartbeat' }>,
  ctx: ExecuteHeartbeatContext = {},
): Promise<{ status: HeartbeatRunStatus; outcome: HeartbeatTriggerOutcome; reason?: string; runId?: string }> {
  const { agentId } = target;
  const trigger: HeartbeatTriggerInfo = {
    kind: ctx.triggerKind === 'manual' ? 'manual' : 'cron',
    firedAt: ctx.firedAt ?? new Date(),
  };
  const log = ctx.logger ?? mastra.getLogger?.();

  const agent = (() => {
    try {
      return mastra.getAgentById(agentId);
    } catch {
      return null;
    }
  })();
  if (!agent) {
    await selfClean(mastra, scheduleId);
    return {
      status: 'agent-missing',
      outcome: 'failed',
      reason: `agent "${agentId}" no longer registered`,
    };
  }

  const hooks =
    (
      mastra as unknown as {
        __getHeartbeatHooks?: () => HeartbeatHooks | null | undefined;
      }
    ).__getHeartbeatHooks?.() ?? undefined;

  // Build a partial `Heartbeat` view for hook contexts. Best-effort —
  // pulls from the live schedule row when available, otherwise from the
  // event target. Either way the hook gets `id`, `agentId`, and `name`.
  const heartbeatRef = await loadHeartbeatRef(mastra, scheduleId, target);

  const rowDefaults: HeartbeatEffective = buildEffectiveFromTarget(target);

  // 1. prepare hook
  let prepared: HeartbeatPrepareResult | null | undefined;
  if (hooks?.prepare) {
    try {
      const prepareCtx: HeartbeatPrepareContext = {
        mastra,
        agentId,
        heartbeat: heartbeatRef,
        trigger,
      };
      prepared = await hooks.prepare(prepareCtx);
    } catch (err) {
      await safeHookCall(log, () =>
        hooks.onError?.({
          mastra,
          agentId,
          heartbeat: heartbeatRef,
          trigger,
          phase: 'prepare',
          error: err instanceof Error ? err : new Error(String(err)),
          effective: rowDefaults,
        }),
      );
      return {
        status: 'invalid-input',
        outcome: 'failed',
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (prepared === null) {
    // Hook explicitly asked to skip this fire.
    await safeHookCall(log, () =>
      hooks?.onFinish?.({
        mastra,
        agentId,
        heartbeat: heartbeatRef,
        trigger,
        outcome: 'skipped',
        effective: rowDefaults,
      }),
    );
    return { status: 'fired', outcome: 'skipped' };
  }

  const effective: HeartbeatEffective = mergeEffective(rowDefaults, prepared);

  // Run-level marker carried on the signal / agent run so consumers
  // (typing status, UI badges) can detect that this run was
  // heartbeat-driven.
  const heartbeatRunMeta = {
    scheduleId,
    ...(effective.threadId ? { threadId: effective.threadId } : {}),
  };

  // 2. threaded vs threadless
  if (effective.threadId) {
    if (!effective.resourceId) {
      const reason = 'resourceId required when threadId is set';
      await safeHookCall(log, () =>
        hooks?.onError?.({
          mastra,
          agentId,
          heartbeat: heartbeatRef,
          trigger,
          phase: 'run',
          error: new Error(reason),
          effective,
        }),
      );
      return { status: 'invalid-input', outcome: 'failed', reason };
    }

    const memory = await agent.getMemory();
    if (memory) {
      const thread = await memory.getThreadById({ threadId: effective.threadId });
      if (!thread) {
        await selfClean(mastra, scheduleId);
        const reason = `thread "${effective.threadId}" not found`;
        await safeHookCall(log, () =>
          hooks?.onError?.({
            mastra,
            agentId,
            heartbeat: heartbeatRef,
            trigger,
            phase: 'run',
            error: new Error(reason),
            effective,
          }),
        );
        return { status: 'thread-missing', outcome: 'failed', reason };
      }
    }

    let signalResult;
    try {
      signalResult = agent.sendSignal(
        {
          type: effective.signalType ?? 'notification',
          tagName: effective.tagName ?? 'heartbeat',
          contents: effective.prompt,
          ...(effective.attributes ? { attributes: effective.attributes } : {}),
          providerOptions: mergeProviderOptions(effective.providerOptions, heartbeatRunMeta),
        },
        {
          resourceId: effective.resourceId,
          threadId: effective.threadId,
          ...(effective.ifActive ? { ifActive: effective.ifActive } : {}),
          ...(effective.ifIdle ? { ifIdle: buildIfIdleOptions(effective.ifIdle) } : {}),
        },
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await safeHookCall(log, () =>
        hooks?.onError?.({
          mastra,
          agentId,
          heartbeat: heartbeatRef,
          trigger,
          phase: 'run',
          error,
          effective,
        }),
      );
      return { status: 'invalid-input', outcome: 'failed', reason: error.message };
    }

    // The signal runtime resolves `accepted` at routing-decision time with the
    // concrete action it took. It only *rejects* when the signal could not be
    // routed at all (e.g. a misconfigured agent) — generation errors on a woken
    // run surface through the run's own stream, never by rejecting here.
    let settled;
    try {
      settled = await signalResult.accepted;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await safeHookCall(log, () =>
        hooks?.onError?.({
          mastra,
          agentId,
          heartbeat: heartbeatRef,
          trigger,
          phase: 'run',
          error,
          effective,
        }),
      );
      return { status: 'invalid-input', outcome: 'failed', reason: error.message };
    }

    const action = settled.action;
    // `runId` is present on `wake`/`deliver`/`blocked` — the actions that reference a
    // concrete agent run. `persist`/`discard` never produce a run id.
    const runId = 'runId' in settled ? settled.runId : undefined;

    if (action === 'deliver') {
      await safeHookCall(log, () =>
        hooks?.onFinish?.({
          mastra,
          agentId,
          heartbeat: heartbeatRef,
          trigger,
          outcome: 'delivered',
          runId,
          joinedExistingRun: true,
          effective,
        }),
      );
      return { status: 'signal-accepted', outcome: 'delivered', runId };
    }
    if (action === 'persist') {
      // Wait briefly for persist write so the trigger row reflects the truth.
      if (signalResult.persisted) {
        try {
          await signalResult.persisted;
        } catch {
          // Persist write failure is surfaced via the signal's own machinery.
        }
      }
      await safeHookCall(log, () =>
        hooks?.onFinish?.({
          mastra,
          agentId,
          heartbeat: heartbeatRef,
          trigger,
          outcome: 'persisted',
          runId,
          effective,
        }),
      );
      return { status: 'signal-accepted', outcome: 'persisted', runId };
    }
    if (action === 'discard') {
      await safeHookCall(log, () =>
        hooks?.onFinish?.({
          mastra,
          agentId,
          heartbeat: heartbeatRef,
          trigger,
          outcome: 'discarded',
          runId,
          effective,
        }),
      );
      return { status: 'signal-accepted', outcome: 'discarded', runId };
    }

    if (action === 'blocked') {
      // The thread was suspended and could not accept an idle wake. Nothing ran
      // and nothing was stored; report as skipped so the trigger row is truthful.
      await safeHookCall(log, () =>
        hooks?.onFinish?.({
          mastra,
          agentId,
          heartbeat: heartbeatRef,
          trigger,
          outcome: 'skipped',
          runId,
          effective,
        }),
      );
      return { status: 'skipped-thread-blocked', outcome: 'skipped', runId };
    }

    // action === 'wake' — a new run was started for this signal. The thread-stream
    // runtime drives the run's stream to completion on its own (so the active-run
    // record and thread lease release without requiring a consumer here); the
    // heartbeat is fire-and-forget for trigger-row purposes.
    await safeHookCall(log, () =>
      hooks?.onFinish?.({
        mastra,
        agentId,
        heartbeat: heartbeatRef,
        trigger,
        outcome: 'succeeded',
        runId,
        effective,
      }),
    );
    return { status: 'signal-accepted', outcome: 'succeeded', runId };
  }

  // 4. threadless path: agent.generate
  try {
    const result = await agent.generate(effective.prompt, {
      providerOptions: mergeProviderOptions(effective.providerOptions, heartbeatRunMeta),
    });
    const runId = extractRunId(result);
    await safeHookCall(log, () =>
      hooks?.onFinish?.({
        mastra,
        agentId,
        heartbeat: heartbeatRef,
        trigger,
        outcome: 'succeeded',
        runId,
        result: extractRunSnapshot(result),
        effective,
      }),
    );
    return { status: 'fired', outcome: 'succeeded', runId };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (isAbortError(error)) {
      await safeHookCall(log, () =>
        hooks?.onAbort?.({
          mastra,
          agentId,
          heartbeat: heartbeatRef,
          trigger,
          runId: extractRunId(error) ?? scheduleId,
          effective,
        }),
      );
      return { status: 'fired', outcome: 'aborted' };
    }
    await safeHookCall(log, () =>
      hooks?.onError?.({
        mastra,
        agentId,
        heartbeat: heartbeatRef,
        trigger,
        phase: 'run',
        error,
        effective,
      }),
    );
    return { status: 'invalid-input', outcome: 'failed', reason: error.message };
  }
}

function buildEffectiveFromTarget(target: Extract<ScheduleTarget, { type: 'heartbeat' }>): HeartbeatEffective {
  return {
    threadId: target.threadId,
    resourceId: target.resourceId,
    prompt: target.prompt,
    signalType: target.signalType,
    tagName: target.tagName,
    attributes: target.attributes,
    providerOptions: target.providerOptions,
    ifActive: target.ifActive,
    ifIdle: target.ifIdle,
  };
}

/**
 * Maps the stored, JSON-safe `ifIdle` config onto the signal API's
 * `AgentSignalIfIdleOptions`, rehydrating the plain `streamOptions.requestContext`
 * object into a live `RequestContext` before the wake signal runs.
 */
function buildIfIdleOptions(ifIdle: HeartbeatIfIdle): AgentSignalIfIdleOptions {
  const requestContext = ifIdle.streamOptions?.requestContext;
  return {
    ...(ifIdle.behavior ? { behavior: ifIdle.behavior } : {}),
    ...(ifIdle.attributes ? { attributes: ifIdle.attributes } : {}),
    ...(requestContext
      ? { streamOptions: { requestContext: new RequestContext(Object.entries(requestContext)) } }
      : {}),
  };
}

function mergeEffective(base: HeartbeatEffective, overrides: HeartbeatPrepareResult | undefined): HeartbeatEffective {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
  };
}

function mergeProviderOptions(
  fromHook: Record<string, unknown> | undefined,
  heartbeatRunMeta: Record<string, unknown>,
): Record<string, any> {
  const base = (fromHook ?? {}) as Record<string, any>;
  const baseMastra = (base.mastra ?? {}) as Record<string, unknown>;
  return {
    ...base,
    mastra: {
      ...baseMastra,
      heartbeat: heartbeatRunMeta,
    },
  };
}

async function loadHeartbeatRef(
  mastra: Mastra,
  scheduleId: string,
  target: Extract<ScheduleTarget, { type: 'heartbeat' }>,
): Promise<{ id: string; agentId: string; name?: string; [key: string]: unknown }> {
  try {
    const hb = await mastra.heartbeats.get(scheduleId);
    if (hb) return { ...hb };
  } catch {
    // ignore — fall back to a minimal projection from the event target
  }
  return {
    id: scheduleId,
    agentId: target.agentId,
    ...(target.name !== undefined ? { name: target.name } : {}),
  };
}

async function safeHookCall(logger: LooseLogger | undefined, fn: () => unknown): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger?.error?.('HeartbeatWorker: hook threw, ignoring', { error: err });
  }
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  return name === 'AbortError';
}

function extractRunId(value: unknown): string | undefined {
  if (value && typeof value === 'object' && 'runId' in value) {
    const runId = (value as { runId?: unknown }).runId;
    if (typeof runId === 'string') return runId;
  }
  return undefined;
}

function extractRunSnapshot(
  value: unknown,
): { text?: string; usage?: Record<string, unknown>; finishReason?: string } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as { text?: unknown; usage?: unknown; finishReason?: unknown };
  const snapshot: { text?: string; usage?: Record<string, unknown>; finishReason?: string } = {};
  if (typeof v.text === 'string') snapshot.text = v.text;
  if (v.usage && typeof v.usage === 'object') snapshot.usage = v.usage as Record<string, unknown>;
  if (typeof v.finishReason === 'string') snapshot.finishReason = v.finishReason;
  return Object.keys(snapshot).length > 0 ? snapshot : undefined;
}
