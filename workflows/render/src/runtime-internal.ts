import { AsyncLocalStorage } from 'node:async_hooks';
import type { TaskContext, TaskDefinition } from '@renderinc/sdk/workflows';
import { unsupported } from './errors.js';

interface Runtime {
  context: TaskContext;
  tasks: ReadonlyMap<string, TaskDefinition<[unknown], unknown>>;
  run?: { workflowId: string; runId: string };
  dispatch?: <T>(execute: () => Promise<T>) => Promise<T>;
}
const runtime = new AsyncLocalStorage<Runtime>();
export function withTaskRuntime<T>(value: Runtime, execute: () => Promise<T>): Promise<T> {
  return runtime.run(value, execute);
}

/** Hydrating this handler's own run must not call the external management API. */
export function isActiveWorkerRun(workflowId: string, runId: string): boolean {
  const active = runtime.getStore()?.run;
  return active?.workflowId === workflowId && active.runId === runId;
}

/** Available only inside a Render worker handler; native chained tasks retain their parent relationship. */
export function getRenderTaskContext(): TaskContext {
  return runtime.getStore()?.context ?? unsupported('accessing Render task context outside a worker execution');
}

export function dispatchChild(name: string, envelope: unknown): Promise<unknown> {
  const active = runtime.getStore();
  const definition = active?.tasks.get(name);
  if (!active || !definition) return unsupported(`unregistered Render child task ${name}`);
  const execute = () => active.context.run(definition, envelope);
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
