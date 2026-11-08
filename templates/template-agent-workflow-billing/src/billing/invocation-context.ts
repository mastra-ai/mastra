import { AsyncLocalStorage } from 'node:async_hooks';
import type { AdmissionIdentity } from './accounting.js';
import type { SafeGenerateOptions } from './mastra-resources.js';
import type { MeasurementCollector } from './measurement.js';

// All facade invocations in this process share parent execution scope, including
// calls through another facade instance. Identity and options stay per adapter.
const parentExecution = new AsyncLocalStorage<MeasurementCollector>();
export class InvocationContext {
  readonly parent = parentExecution;
  readonly identity = new AsyncLocalStorage<AdmissionIdentity>();
  readonly agentOptions = new AsyncLocalStorage<SafeGenerateOptions>();
}
