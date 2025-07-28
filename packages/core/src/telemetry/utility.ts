import { propagation, trace } from '@opentelemetry/api';
import type { Context } from '@opentelemetry/api';

// Helper function to check if telemetry is active
export function hasActiveTelemetry(tracerName: string = 'default-tracer'): boolean {
  try {
    return !!trace.getTracer(tracerName);
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
