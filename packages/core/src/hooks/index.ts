import type { Metric, MetricResult } from '../eval/metric';
import type { TestInfo } from '../eval/types';

import mitt from './mitt';
import type { Handler } from './mitt';

export enum AvailableHooks {
  ON_EVALUATION = 'onEvaluation',
  ON_GENERATION = 'onGeneration',
}

const hooks = mitt();

type EvaluationHookData = {
  input: string;
  output: string;
  result: MetricResult;
  agentName: string;
  metricName: string;
  instructions: string;
  runId: string;
  globalRunId: string;
  testInfo?: TestInfo;
};

type GenerationHookData = {
  input: string;
  output: string;
  metric: Metric;
  runId: string;
  agentName: string;
  instructions: string;
};

export function registerHook(hook: AvailableHooks.ON_EVALUATION, action: Handler<EvaluationHookData>): void;
export function registerHook(hook: AvailableHooks.ON_GENERATION, action: Handler<GenerationHookData>): void;
export function registerHook(hook: `${AvailableHooks}`, action: Handler<any>): void {
  hooks.on(hook, action);
}

export function executeHook(hook: AvailableHooks.ON_EVALUATION, action: EvaluationHookData): void;
export function executeHook(hook: AvailableHooks.ON_GENERATION, action: GenerationHookData): void;

export function executeHook(hook: `${AvailableHooks}`, data: unknown): void {
  // do not block the main thread
  setImmediate(() => {
    hooks.emit(hook, data);
  });
}
