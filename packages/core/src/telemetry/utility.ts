import { propagation, trace } from '@opentelemetry/api';
import type { Context } from '@opentelemetry/api';

/**
 * Check if telemetry is active and enabled.
 * This function checks both if telemetry is enabled in the configuration AND if a tracer exists.
 *
 * @param tracerName - Optional tracer name to check (currently unused, kept for backwards compatibility)
 * @returns true if telemetry is both initialized and enabled, false otherwise
 */
export function hasActiveTelemetry(tracerName: string = 'default-tracer'): boolean {
  try {
    const isEnabled = globalThis.__TELEMETRY__?.isEnabled() ?? true;
    return isEnabled && !!trace.getTracer(tracerName);
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
