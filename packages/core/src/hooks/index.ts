import type { ScoringHookInput } from '../evals';

import mitt from './mitt';
import type { Handler } from './mitt';

export enum AvailableHooks {
  ON_EVALUATION = 'onEvaluation',
  ON_GENERATION = 'onGeneration',
  ON_SCORER_RUN = 'onScorerRun',
}

const hooks = mitt();

export function registerHook(hook: AvailableHooks.ON_SCORER_RUN, action: Handler<ScoringHookInput>): void;
export function registerHook(hook: `${AvailableHooks}`, action: Handler<any>): void {
  hooks.on(hook, action);
}

export function deregisterHook(hook: AvailableHooks.ON_SCORER_RUN, action: Handler<ScoringHookInput>): void;
export function deregisterHook(hook: `${AvailableHooks}`, action: Handler<any>): void {
  hooks.off(hook, action);
}

export function executeHook(hook: AvailableHooks.ON_SCORER_RUN, action: ScoringHookInput): void;
export function executeHook(hook: `${AvailableHooks}`, data: unknown): void {
  // do not block the main thread
  setImmediate(() => {
    hooks.emit(hook, data);
  });
}

/**
 * Number of handlers currently registered for a hook on the module-level
 * emitter. The emitter never drops handlers on its own, so leak regression
 * tests use this to assert that short-lived instances (e.g. a standalone
 * Agent's ephemeral Mastra) don't accumulate handlers (#19404).
 *
 * @internal test-only
 */
export function __hookHandlerCount(hook: `${AvailableHooks}`): number {
  return hooks.all.get(hook)?.length ?? 0;
}
