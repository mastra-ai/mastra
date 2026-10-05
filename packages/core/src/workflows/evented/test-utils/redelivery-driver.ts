/**
 * Test-only driver that simulates at-least-once delivery on the evented
 * workflow engine. Not exported from any package entry point.
 *
 * The driver owns an `EventEmitterPubSub` (`driver.pubsub`). Every event
 * published on the `workflows` topic is cloned the moment it is emitted, so
 * later mutations by the engine don't leak into the capture. A test then picks
 * a `workflow.step.run` by `<workflowId>@<executionPath>` and re-delivers a
 * clone of it whenever it chooses — there are no timers involved.
 *
 * Evented engine only: `assertEvented()` throws for any other engine, and the
 * default engine never publishes `workflow.step.run`, so `redeliver()` would
 * throw "no captured step.run" anyway.
 *
 * Workflow step:
 *
 *   const driver = new RedeliveryDriver();
 *   const mastra = new Mastra({ logger: false, storage, workflows: { wf }, pubsub: driver.pubsub });
 *   await mastra.startWorkers();
 *   driver.assertEvented(wf);
 *   const run = await wf.createRun({ runId: 'run-1' });
 *   await run.start({ inputData: {} });
 *   const { results } = await driver.redeliver({ runId: 'run-1', spec: 'my-wf@1' });
 *   expect(driver.deliveryCount({ runId: 'run-1', spec: 'my-wf@1' })).toBe(2);
 *   driver.dispose();
 *
 * Durable agent tool step (the tool-call step of `durable-agentic-execution`):
 *
 *   const end = driver.waitForStepEnd({ spec: 'tool-step' });
 *   await (await agent.stream('hi')).consumeStream();
 *   await end;
 *   await driver.redeliver({ spec: 'tool-step' });
 *
 * `redeliver()` re-emits the captured event with its original id and
 * `deliveryAttempt` 2 (what a broker does after a missed ack) and resolves
 * with the `WorkflowEventProcessor.handle()` results for that delivery. It
 * throws when nothing matches the spec or no processor consumed the
 * duplicate, so a spec that never matched fails the test instead of passing
 * silently. Pass `{ freshId: true }` to republish under a new event id
 * instead (what the external validation harness does).
 *
 * Redelivering the step.run of a step that already *completed* re-executes it
 * today (F4). That is owned by COR-1307 and is red until that fix lands, so
 * only use the driver for completed-step outcome assertions alongside it.
 */
import EventEmitter from 'node:events';
import { vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { DurableStepIds } from '../../../agent/durable/constants';
import type { Event } from '../../../events';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { WorkflowEventProcessor } from '../workflow-event-processor';

const WORKFLOWS_TOPIC = 'workflows';

/**
 * Path of the tool-call step inside `durable-agentic-execution`. Verified
 * against the captured events of a live evented agent run in
 * `redelivery-driver.test.ts`.
 */
export const TOOL_STEP_PATH: readonly number[] = [3, 0];

/** `'tool-step'`, `'<path>'` (e.g. `'1'`, `'3,0'`) or `'<workflowId>@<path>'`. */
export type RedeliverySpec = string;

export interface RedeliveryMatch {
  spec: RedeliverySpec;
  /** Restrict to events whose `data.runId` is this run. */
  runId?: string;
}

interface ParsedSpec {
  workflowId?: string;
  executionPath: number[];
}

type HandleResult = Awaited<ReturnType<WorkflowEventProcessor['handle']>>;

export interface RedeliveryOutcome {
  /** The event that was re-delivered. */
  event: Event;
  /** One result per `WorkflowEventProcessor.handle()` call that received it. */
  results: HandleResult[];
}

/**
 * Deep-copies the data parts of an event (arrays, plain objects, dates).
 * Anything else — functions and class instances, which some agent events
 * carry and `structuredClone` rejects — is kept by reference.
 */
export function snapshotClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => snapshotClone(item)) as T;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      const copy: Record<string, unknown> = proto === null ? Object.create(null) : {};
      for (const [key, item] of Object.entries(value)) copy[key] = snapshotClone(item);
      return copy as T;
    }
  }
  return value;
}

function parseSpec(spec: RedeliverySpec): ParsedSpec {
  if (spec === 'tool-step') {
    return { workflowId: DurableStepIds.AGENTIC_EXECUTION, executionPath: [...TOOL_STEP_PATH] };
  }
  const at = spec.lastIndexOf('@');
  const workflowId = at >= 0 ? spec.slice(0, at) : undefined;
  const pathText = at >= 0 ? spec.slice(at + 1) : spec;
  const executionPath = pathText.split(',').map(part => Number(part.trim()));
  if (pathText.trim() === '' || executionPath.some(n => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Invalid redelivery spec "${spec}"`);
  }
  if (workflowId === '') {
    throw new Error(`Invalid redelivery spec "${spec}"`);
  }
  return { workflowId, executionPath };
}

function matches(event: Event, parsed: ParsedSpec, runId?: string): boolean {
  const data = event.data as { workflowId?: string; runId?: string; executionPath?: number[] } | undefined;
  if (!data) return false;
  if (runId !== undefined && data.runId !== runId) return false;
  if (parsed.workflowId !== undefined && data.workflowId !== parsed.workflowId) return false;
  const path = data.executionPath;
  return (
    Array.isArray(path) &&
    path.length === parsed.executionPath.length &&
    path.every((n, i) => n === parsed.executionPath[i])
  );
}

interface PendingWait {
  parsed: ParsedSpec;
  runId?: string;
  resolve: (event: Event) => void;
  reject: (error: Error) => void;
  spec: RedeliverySpec;
}

export class RedeliveryDriver {
  readonly pubsub: EventEmitterPubSub;
  /** Every `workflows`-topic event, cloned at emit time, in emit order. */
  readonly events: Event[] = [];

  #emitter = new EventEmitter();
  #waits: PendingWait[] = [];
  #handled: { event: Event; result: Promise<HandleResult> }[] = [];
  #handleSpy: MockInstance<WorkflowEventProcessor['handle']>;
  #injecting: Event | undefined;
  #disposed = false;

  constructor() {
    // Registered before any subscriber, so the clone is taken before the
    // engine sees (and can mutate) the event.
    this.#emitter.on(WORKFLOWS_TOPIC, (event: Event) => this.#capture(event));
    this.pubsub = new EventEmitterPubSub(this.#emitter);

    const driver = this;
    const handled = this.#handled;
    const original = WorkflowEventProcessor.prototype.handle;
    this.#handleSpy = vi.spyOn(WorkflowEventProcessor.prototype, 'handle').mockImplementation(function (
      this: WorkflowEventProcessor,
      delivered: Event,
    ) {
      // Group delivery copies the event and recomputes deliveryAttempt from
      // its own per-id counter, so re-apply the injected attempt here.
      const injecting = driver.#injecting;
      const event =
        injecting && delivered.id === injecting.id
          ? { ...delivered, deliveryAttempt: injecting.deliveryAttempt }
          : delivered;
      const result = original.call(this, event);
      handled.push({ event, result });
      return result;
    });
  }

  /** Throws unless the workflow (or a durable agent's workflow) runs on the evented engine. */
  assertEvented(target: { engineType?: string }): void {
    if (target?.engineType !== 'evented') {
      throw new Error(`Redelivery is only supported on the evented engine (got "${target?.engineType ?? 'unknown'}")`);
    }
  }

  /** Captured `workflow.step.run` deliveries (originals and redeliveries) matching the spec. */
  stepRuns(match: RedeliveryMatch): Event[] {
    const parsed = parseSpec(match.spec);
    return this.events.filter(e => e.type === 'workflow.step.run' && matches(e, parsed, match.runId));
  }

  /** How many times a matching `workflow.step.run` was delivered, including redeliveries. */
  deliveryCount(match: RedeliveryMatch): number {
    return this.stepRuns(match).length;
  }

  /**
   * Resolves with the first matching `workflow.step.end` (including one that
   * was already emitted). Rejects when the driver is disposed first, so a
   * spec that never matches cannot pass as a success.
   */
  waitForStepEnd(match: RedeliveryMatch): Promise<Event> {
    const parsed = parseSpec(match.spec);
    const existing = this.events.find(e => e.type === 'workflow.step.end' && matches(e, parsed, match.runId));
    if (existing) return Promise.resolve(existing);
    if (this.#disposed) return Promise.reject(new Error('RedeliveryDriver is disposed'));
    return new Promise((resolve, reject) => {
      this.#waits.push({ parsed, runId: match.runId, resolve, reject, spec: match.spec });
    });
  }

  /**
   * Re-delivers a clone of the most recent original (`deliveryAttempt` 1)
   * matching `workflow.step.run` and resolves once every workflow event
   * processor that received it has finished handling it.
   */
  async redeliver(
    match: RedeliveryMatch,
    options: { deliveryAttempt?: number; freshId?: boolean } = {},
  ): Promise<RedeliveryOutcome> {
    if (this.#disposed) throw new Error('RedeliveryDriver is disposed');
    const original = this.stepRuns(match)
      .filter(e => e.deliveryAttempt === 1)
      .at(-1);
    if (!original) {
      throw new Error(
        `No captured workflow.step.run matches "${match.spec}"${match.runId ? ` for run ${match.runId}` : ''}`,
      );
    }

    const event: Event = {
      ...snapshotClone(original),
      id: options.freshId ? globalThis.crypto.randomUUID() : original.id,
      createdAt: new Date(),
      deliveryAttempt: options.deliveryAttempt ?? 2,
    };
    const before = this.#handled.length;
    this.#injecting = event;
    try {
      this.#emitter.emit(WORKFLOWS_TOPIC, event);
    } finally {
      this.#injecting = undefined;
    }
    // Subscribers invoke the processor synchronously from emit(), so every
    // consumer of this delivery has registered its handle() call by now.
    const calls = this.#handled.slice(before).filter(h => h.event.id === event.id);
    if (calls.length === 0) {
      throw new Error(
        `Redelivered workflow.step.run for "${match.spec}" was not consumed by any workflow event processor (are workers started?)`,
      );
    }
    const results = await Promise.all(calls.map(c => c.result));
    return { event, results };
  }

  /** Restores the processor spy and rejects any step-end wait that never matched. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#handleSpy.mockRestore();
    const waits = this.#waits.splice(0);
    for (const wait of waits) {
      wait.reject(new Error(`workflow.step.end for "${wait.spec}" was never observed`));
    }
  }

  #capture(event: Event): void {
    const snapshot = snapshotClone(event);
    this.events.push(snapshot);
    if (snapshot.type !== 'workflow.step.end') return;
    this.#waits = this.#waits.filter(wait => {
      if (!matches(snapshot, wait.parsed, wait.runId)) return true;
      wait.resolve(snapshot);
      return false;
    });
  }
}
