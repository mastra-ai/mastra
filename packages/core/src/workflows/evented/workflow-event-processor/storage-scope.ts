import { AsyncLocalStorage } from 'node:async_hooks';
import type { PubSub } from '../../../events/pubsub';
import type { Event } from '../../../events/types';
import { applyStatePatch, diffStateAsJson, patchState } from '../../../storage/domains/workflows/state-patch';
import type { StatePatchOp } from '../../../storage/domains/workflows/state-patch';
import type { WorkflowRunState } from '../../../workflows/types';
import { copyState, toJsonState } from '../../nested-state';
import type { RunStorage } from '../../run-storage';

/**
 * Storage v2 for the evented engine. Every event of a v2 run carries `storageVersion: 2`, and its
 * dispatch runs in a scope that:
 *
 * - fills the event's step results and state in from the stored run (`hydrateEventData`), so
 *   step messages don't carry them (`publish` trims them);
 * - remembers each run's state as stored (`bases`): state on a step message travels as a patch
 *   against it, and state writes go to the store as patches against it, so concurrent writers
 *   (parallel branches, foreach iterations) keep each other's changes.
 */
type StorageScope = {
  storageVersion: 1 | 2;
  /**
   * Per run id: its state as stored (JSON), as this dispatch last loaded or wrote it. Never changed
   * in place: it is the loaded run's own state, and a write replaces it with a patched copy.
   */
  bases: Map<string, Record<string, unknown>>;
};

const scopes = new AsyncLocalStorage<StorageScope>();

/** Step messages: the processor loads their step results and state from storage. */
const TRIMMED_EVENTS = new Set(['workflow.step.run', 'workflow.step.end']);

export function runInStorageScope<T>(storageVersion: 1 | 2, fn: () => T): T {
  return scopes.run({ storageVersion, bases: new Map() }, fn);
}

/** Runs `fn` outside any scope, so timers it sets don't hold on to the dispatch's state. */
export function outsideStorageScope<T>(fn: () => T): T {
  return scopes.exit(fn);
}

export function currentStorageVersion(): 1 | 2 {
  return scopes.getStore()?.storageVersion ?? 1;
}

export function storageVersionOf(data: unknown): 1 | 2 {
  return (data as { storageVersion?: unknown } | undefined)?.storageVersion === 2 ? 2 : 1;
}

function toJson(state: unknown): Record<string, unknown> {
  const json = toJsonState(state);
  if (!json) {
    throw new Error('Workflow state must be JSON-serializable on storage v2');
  }
  return json;
}

/** The ops that turn the stored state `base` into `state`'s JSON form, without copying `state`. */
function statePatchOn(base: Record<string, unknown>, state: unknown): StatePatchOp[] {
  try {
    return diffStateAsJson(base, state ?? {});
  } catch {
    throw new Error('Workflow state must be JSON-serializable on storage v2');
  }
}

/**
 * A v2 event's data with the stored run filled in: step results the message doesn't carry, and
 * its state (sent whole, or as a patch on the stored state). Start events carry their own.
 */
export function hydrateEventData(
  type: string,
  data: Record<string, any>,
  stored: WorkflowRunState | null | undefined,
): Record<string, any> {
  const scope = scopes.getStore()!;
  // Stores load a v2 run's state as JSON, and `stored` is this dispatch's own load, so it is the base as it is.
  const base = stored?.value ?? {};
  scope.bases.set(data.runId, base);
  if (type === 'workflow.start') return data;

  const { statePatch, ...rest } = data;
  // A message that carries its state whole (one that isn't trimmed, or another run's hand-back) keeps it.
  const state =
    rest.state ?? rest.stepResults?.__state ?? applyStatePatch(copyState(base), (statePatch ?? []) as StatePatchOp[]);
  const { __state: _storedState, ...storedSteps } = (stored?.context ?? {}) as Record<string, any>;
  return {
    ...rest,
    state,
    stepResults: { ...storedSteps, __state: state, ...rest.stepResults },
  };
}

/**
 * A step message's data without what the next dispatch loads: the step results, and the state,
 * which becomes a patch on the run's stored state. Another run's state (a nested run handing back
 * to its parent) is sent whole.
 */
function trimStepEventData(data: Record<string, any>, scope: StorageScope): Record<string, any> {
  const { state, stepResults, prevResult, ...rest } = data;
  const trimmed: Record<string, any> = rest;

  const base = scope.bases.get(data.runId);
  if (!base) {
    if (prevResult !== undefined) trimmed.prevResult = prevResult;
    if (state !== undefined) trimmed.state = state;
    return trimmed;
  }

  // The state the receiving handler would resolve (see `resolveCurrentState`).
  const current = prevResult?.__state ?? stepResults?.__state ?? state;
  if (prevResult != null) {
    const { __state: _state, ...result } = prevResult;
    trimmed.prevResult = result;
  }
  if (current !== undefined) {
    const statePatch = statePatchOn(base, current);
    if (statePatch.length > 0) trimmed.statePatch = statePatch;
  }
  return trimmed;
}

/**
 * A nested run's parent (or ancestor) descriptor without the parent's step results, which its
 * dispatches load, and without the nested step's input unless `keepInput`: the nested run's start
 * stores that input as the step's payload in the parent.
 */
function trimParent(parent: Record<string, any>, keepInput: boolean): Record<string, any> {
  const { stepResults: _stepResults, input, parentWorkflow, ...rest } = parent;
  return {
    ...rest,
    ...(keepInput && { input }),
    ...(parentWorkflow && { parentWorkflow: trimParent(parentWorkflow, false) }),
  };
}

/** Events that start a nested run, whose start needs its parent descriptor's `input`. */
const NESTED_START_EVENTS = new Set(['workflow.start', 'workflow.resume']);

function scopedEvent(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Omit<Event, 'id' | 'createdAt'> {
  const scope = scopes.getStore();
  if (topic !== 'workflows' || scope?.storageVersion !== 2 || !event.data) return event;
  const data = TRIMMED_EVENTS.has(event.type) ? trimStepEventData(event.data, scope) : { ...event.data };
  if (data.parentWorkflow) data.parentWorkflow = trimParent(data.parentWorkflow, NESTED_START_EVENTS.has(event.type));
  if (data.parentContext) data.parentContext = trimParent(data.parentContext, false);
  return { ...event, data: { ...data, storageVersion: 2 } };
}

const scopedPubSubs = new WeakMap<PubSub, PubSub>();

/** `pubsub`, with `workflows` events published in a v2 scope tagged and trimmed. */
export function scopedPubSub(pubsub: PubSub): PubSub {
  let scoped = scopedPubSubs.get(pubsub);
  if (!scoped) {
    scoped = new Proxy(pubsub, {
      get(target, prop) {
        if (prop === 'publish') {
          return (topic: string, event: Omit<Event, 'id' | 'createdAt'>) =>
            target.publish(topic, scopedEvent(topic, event));
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    scopedPubSubs.set(pubsub, scoped);
  }
  return scoped;
}

/** `runStorage`, with whole-state writes in a v2 scope sent as patches on the run's stored state. */
export function scopedRunStorage(runId: string, runStorage: RunStorage): RunStorage {
  const scope = scopes.getStore();
  if (scope?.storageVersion !== 2) return runStorage;

  const toPatch = async <W extends { state?: Record<string, any> }>({ state, ...write }: W) => {
    if (state === undefined) return write;
    const base = scope.bases.get(runId) ?? (await runStorage.loadState());
    const statePatch = statePatchOn(base, state);
    scope.bases.set(runId, patchState(base, statePatch));
    return statePatch.length > 0 ? { ...write, statePatch } : write;
  };

  const overrides: Partial<RunStorage> = {
    writeStepResult: async write => {
      const patched = await toPatch(write);
      try {
        return await runStorage.writeStepResult(patched);
      } catch (error) {
        // A rejected write (a step guard conflict) leaves the stored state as it was, not as `toPatch` assumed.
        scope.bases.delete(runId);
        throw error;
      }
    },
    mergeStepResult: async write => runStorage.mergeStepResult(await toPatch(write)),
    writeState: async write => runStorage.writeState(await toPatch(write)),
    writeSnapshot: async (snapshot, resourceId, opts) => {
      await runStorage.writeSnapshot(snapshot, resourceId, opts);
      if (opts?.stateBase) scope.bases.delete(runId);
      else scope.bases.set(runId, toJson(snapshot.value));
    },
    delete: async () => {
      await runStorage.delete();
      scope.bases.delete(runId);
    },
  };

  return new Proxy(runStorage, {
    get(target, prop) {
      const override = overrides[prop as keyof RunStorage];
      if (override) return override;
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
