import { AsyncLocalStorage } from 'node:async_hooks';
import type { TaskContext, TaskDefinition } from '@renderinc/sdk/workflows';
import { unsupported } from './errors.js';
import { json, type RootEnvelope } from './protocol.js';

interface Runtime {
  context: TaskContext;
  tasks: ReadonlyMap<string, TaskDefinition<[unknown], unknown>>;
  run?: { workflowId: string; runId: string };
  localRunId?: string;
  attempt?: string;
  readOnly?: boolean;
  dispatch?: <T>(execute: () => Promise<T>) => Promise<T>;
  assertActive?: () => Promise<void>;
  authorize?: <T extends RootEnvelope>(envelope: T) => T;
}
const runtime = new AsyncLocalStorage<Runtime>();
/** Scope native task context and dispatch authority to this asynchronous worker execution. */
export function withTaskRuntime<T>(value: Runtime, execute: () => Promise<T>): Promise<T> {
  return runtime.run(value, execute);
}

/** Hydrating this handler's own run must not call the external management API. */
export function isActiveWorkerRun(workflowId: string, runId: string): boolean {
  const active = runtime.getStore();
  return active?.run?.workflowId === workflowId && (active.run.runId === runId || active.localRunId === runId);
}

export function coordinatorRuntime() {
  const active = runtime.getStore();
  if (!active?.run || !active.attempt || !active.assertActive)
    return unsupported('workflow execution outside its Render coordinator');
  return active as typeof active & {
    run: { workflowId: string; runId: string };
    attempt: string;
    assertActive: () => Promise<void>;
  };
}

export function inheritedReadOnly(): boolean {
  return runtime.getStore()?.readOnly ?? false;
}

export function logicalRunId(fallback: string): string {
  return runtime.getStore()?.run?.runId ?? fallback;
}

/** Available only inside a Render worker handler; native chained tasks retain their parent relationship. */
export function getRenderTaskContext(): TaskContext {
  return runtime.getStore()?.context ?? unsupported('accessing Render task context outside a worker execution');
}

/** Authorize a complete child payload and run its registered native definition under the root concurrency bound. */
export function dispatchChild(name: string, envelope: RootEnvelope): Promise<unknown> {
  const active = runtime.getStore();
  const definition = active?.tasks.get(name);
  if (!active?.authorize || !definition) return unsupported(`unauthorized Render child dispatch ${name}`);
  const execute = async () => {
    await active.assertActive?.();
    const authorized = active.authorize!(envelope);
    json([authorized], 'authorized task arguments');
    const result = await active.context.run(definition, authorized);
    await active.assertActive?.();
    return result;
  };
  return active.dispatch ? active.dispatch(execute) : execute();
}

/** Per-root bound, not a replacement for Render's workspace rate limit or queue. */
export function createDispatchLimiter(maxConcurrent: number) {
  let running = 0;
  const queue: (() => void)[] = [];
  return async <T>(execute: () => Promise<T>): Promise<T> => {
    if (running >= maxConcurrent) await new Promise<void>(resolve => queue.push(resolve));
    else running++;
    try {
      return await execute();
    } finally {
      const next = queue.shift();
      if (next) next();
      else running--;
    }
  };
}
