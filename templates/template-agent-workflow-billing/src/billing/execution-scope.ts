import { AsyncLocalStorage } from 'node:async_hooks';
import { BillingError } from './contracts.js';
import type { MeasurementCollector } from './measurement.js';

export interface ExecutionScope {
  readonly collector: MeasurementCollector;
  readonly prompt: string;
  readonly signal: AbortSignal;
  readonly slot: number;
  readonly checkpoint: () => Promise<void>;
}
const execution = new AsyncLocalStorage<ExecutionScope>();
export function currentExecution(): ExecutionScope {
  const scope = execution.getStore();
  if (!scope) throw new BillingError('forbidden');
  return scope;
}
export const withinExecution = <T>(scope: ExecutionScope, work: () => Promise<T>) => execution.run(scope, work);
