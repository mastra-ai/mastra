import { AsyncLocalStorage } from 'node:async_hooks';
import { BillingError } from '../contracts/core.js';
import type { MeasurementCollector } from './measurement.js';

export interface ExecutionScope {
  /** Billing-owned usage collector and durable execution identity. */
  readonly collector: MeasurementCollector;
  /** Server-validated prompt for this admitted execution slot. */
  readonly prompt: string;
  /** Cancellation signal tied to the execution deadline and caller cancellation. */
  readonly signal: AbortSignal;
  /** Zero-based artifact slot within the parent execution budget. */
  readonly slot: number;
  /** Recheck authorization and the persisted execution cutoff before external work. */
  readonly checkpoint: () => Promise<void>;
}
const execution = new AsyncLocalStorage<ExecutionScope>();
export function currentExecution(): ExecutionScope {
  const scope = execution.getStore();
  if (!scope) throw new BillingError('forbidden');
  return scope;
}
/** Leave only the financial scope; conversation cancellation is not business cancellation. */
export const outsideExecution = <T>(work: () => T): T => execution.exit(work);
export const withinExecution = <T>(scope: ExecutionScope, work: () => Promise<T>) => execution.run(scope, work);
