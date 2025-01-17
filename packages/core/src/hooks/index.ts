import { MetricResult } from '../eval/metric';

import mitt, { Handler } from './mitt';

export enum AvailableHooks {
  ON_EVALUATION = 'onEvaluation',
}

const hooks = mitt();

export function registerHook(
  hook: `onEvaluation`,
  action: Handler<{
    input: string;
    output: string;
  }>,
): void;
export function registerHook(hook: `${AvailableHooks}`, action: Handler<any>): void {
  hooks.on(hook, action);
}

export function executeHook(
  hook: `onEvaluation`,
  action: {
    input: string;
    output: string;
    result: MetricResult;
  },
): void;
export function executeHook(hook: `${AvailableHooks}`, data: unknown): void {
  // do not block the main thread
  setImmediate(() => {
    hooks.emit(hook, data);
  });
}
