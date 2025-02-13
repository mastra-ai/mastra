import { trace } from '@opentelemetry/api';

// Helper function to check if telemetry is active
export function hasActiveTelemetry(tracerName: string = 'default-tracer'): boolean {
  try {
    return !!trace.getTracer(tracerName);
  } catch {
    return false;
  }
}
