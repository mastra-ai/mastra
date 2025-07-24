import { propagation, trace, context } from '@opentelemetry/api';
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
  return {
    requestId,
    componentName,
    runId,
    threadId,
  };
}

/**
 * Set attributes on the active span and propagate context with baggage
 * @param attributes Attributes to set on the active span
 * @param ctx Optional context to use, defaults to active context
 * @returns New context with updated baggage
 */
export function setActiveSpanAttributes(attributes: Record<string, string>, ctx?: Context): Context {
  const activeContext = ctx || context.active();
  const activeSpan = trace.getActiveSpan();

  if (activeSpan) {
    // Set attributes on the active span
    Object.entries(attributes).forEach(([key, value]) => {
      activeSpan.setAttribute(key, value);
    });
  }

  // Create baggage for context propagation
  const baggageEntries: Record<string, { value: string }> = {};
  Object.entries(attributes).forEach(([key, value]) => {
    baggageEntries[key] = { value };
  });

  // Get existing baggage and merge with new entries
  const currentBaggage = propagation.getBaggage(activeContext);
  const existingEntries: Record<string, { value: string }> = {};

  if (currentBaggage) {
    currentBaggage.getAllEntries().forEach(([key, entry]) => {
      existingEntries[key] = { value: entry.value };
    });
  }

  const mergedBaggage = propagation.createBaggage({
    ...existingEntries,
    ...baggageEntries,
  });

  return propagation.setBaggage(activeContext, mergedBaggage);
}
