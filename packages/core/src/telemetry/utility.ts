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

export function getBaggageValues(ctx: Context) {
  const currentBaggage = propagation.getBaggage(ctx);
  console.log('currentBaggage', currentBaggage);
  const requestId = currentBaggage?.getEntry('http.request_id')?.value;
  const componentName = currentBaggage?.getEntry('componentName')?.value;
  const runId = currentBaggage?.getEntry('runId')?.value;
  return {
    requestId,
    componentName,
    runId,
  };
}
