import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Ambient run identity for span-less pulse emission.
 *
 * The agent enters this context once, around the workflow execution that
 * drives a run (agent.ts). Every async continuation created inside — the
 * model loop, tool executions, processors, memory operations — inherits
 * it, so call sites that have no runId in scope (processors/runner.ts,
 * processors/memory/message-history.ts) can still mint pulse identity
 * when observability is off. Sites that DO know their runId keep passing
 * it explicitly; the ambient value is only the fallback.
 */
export interface PulseRunContext {
  runId: string;
  threadId?: string;
  resourceId?: string;
}

const storage = new AsyncLocalStorage<PulseRunContext>();

export function withPulseRun<T>(ctx: PulseRunContext | undefined, fn: () => T): T {
  return ctx?.runId ? storage.run(ctx, fn) : fn();
}

export function activePulseRun(): PulseRunContext | undefined {
  return storage.getStore();
}
