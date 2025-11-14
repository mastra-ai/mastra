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

export function executeHook(hook: AvailableHooks.ON_SCORER_RUN, action: ScoringHookInput): void;
export function executeHook(hook: `${AvailableHooks}`, data: unknown): void {
  // do not block the main thread
  setImmediate(() => {
    hooks.emit(hook, data);
  });
}
