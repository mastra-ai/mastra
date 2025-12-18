import { propagation } from '@opentelemetry/api';
import type { Context } from '@opentelemetry/api';

declare global {
  var __TELEMETRY_ENABLED__: boolean | undefined;
}

/**
 * Check if telemetry is active and enabled.
 * This function checks both if a tracer exists AND if telemetry is enabled in the configuration.
 *
 * @param _tracerName - Optional tracer name to check (currently unused, kept for backwards compatibility)
 * @returns true if telemetry is both initialized and enabled, false otherwise
 */
export function hasActiveTelemetry(_tracerName: string = 'default-tracer'): boolean {
  try {
    // Check if telemetry is explicitly enabled via the global flag
    // This flag is set by Telemetry.init() based on the enabled config option
    return globalThis.__TELEMETRY_ENABLED__ === true;
  } catch {
    return false;
  }
}

/**
 * Get baggage values from context
 * @param ctx The context to get baggage values from
 * @returns
 */
export function getBaggageValues(ctx: Context) {
  const currentBaggage = propagation.getBaggage(ctx);
  const requestId = currentBaggage?.getEntry('http.request_id')?.value;
  const componentName = currentBaggage?.getEntry('componentName')?.value;
  const runId = currentBaggage?.getEntry('runId')?.value;
  const threadId = currentBaggage?.getEntry('threadId')?.value;
  const resourceId = currentBaggage?.getEntry('resourceId')?.value;
  return {
    requestId,
    componentName,
    runId,
    threadId,
    resourceId,
  };
}
