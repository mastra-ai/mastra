import { Metric, MetricResult } from '../eval/metric';

import mitt, { Handler } from './mitt';

export enum AvailableHooks {
  ON_EVALUATION = 'onEvaluation',
  ON_GENERATION = 'onGeneration',
}

const hooks = mitt();

export function registerHook(
  hook: AvailableHooks.ON_EVALUATION,
  action: Handler<{
    input: string;
    output: string;
    result: MetricResult;
    meta: Record<string, any>;
  }>,
): void;
export function registerHook(
  hook: AvailableHooks.ON_GENERATION,
  action: Handler<{
    input: string;
    output: string;
    metric: Metric;
    runId: string;
    agentName: string;
  }>,
): void;
export function registerHook(hook: `${AvailableHooks}`, action: Handler<any>): void {
  hooks.on(hook, action);
}

export function executeHook(
  hook: AvailableHooks.ON_EVALUATION,
  action: {
    input: string;
    output: string;
    result: MetricResult;
  },
): void;
export function executeHook(
  hook: AvailableHooks.ON_GENERATION,
  action: {
    input: string;
    output: string;
    metric: Metric;
    runId: string;
    agentName: string;
  },
): void;

export function executeHook(hook: `${AvailableHooks}`, data: unknown): void {
  // do not block the main thread
  setImmediate(() => {
    hooks.emit(hook, data);
  });
}
