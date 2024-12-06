import { trace } from '@opentelemetry/api';

// Helper function to check if telemetry is active
export function hasActiveTelemetry(): boolean {
  try {
    return !!trace.getTracer('default-tracer');
  } catch {
    return false;
  }
}
