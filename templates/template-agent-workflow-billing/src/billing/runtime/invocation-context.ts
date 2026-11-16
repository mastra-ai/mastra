import { AsyncLocalStorage } from 'node:async_hooks';
import type { AdmissionIdentity } from './accounting.js';
import type { SafeGenerateOptions } from '../mastra-resources.js';
import type { MeasurementCollector } from './measurement.js';

// All facade invocations in this process share parent execution scope, including
// calls through another facade instance. Identity and options stay per adapter.
const parentExecution = new AsyncLocalStorage<MeasurementCollector>();
const currentAgentDependencies = new AsyncLocalStorage<readonly string[]>();
/** Business calls from conversation tools must never inherit another billed parent. */
export const outsideParentExecution = <T>(work: () => T): T =>
  parentExecution.exit(() => currentAgentDependencies.exit(work));
export class InvocationContext {
  readonly parent = parentExecution;
  readonly agentDependencies = currentAgentDependencies;
  readonly identity = new AsyncLocalStorage<AdmissionIdentity>();
  readonly agentOptions = new AsyncLocalStorage<SafeGenerateOptions>();
}
