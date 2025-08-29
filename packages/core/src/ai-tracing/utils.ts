/**
 * Utility functions for cleaning and manipulating metadata objects
 * used in AI tracing and observability.
 */

import type { RuntimeContext } from '../di';
import { getSelectedAITracing } from './registry';
import type { AISpan, AISpanType, AISpanTypeMap, TracingContext } from './types';

/**
 * Removes non-serializable values from a metadata object.
 * @param metadata - An object with arbitrary values
 * @returns A new object with only serializable entries
 */
export function sanitizeMetadata(metadata: Record<string, any> | undefined): Record<string, any> {
  if (!metadata) return {};
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isSerializable(value)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Checks if a value can be safely JSON-stringified.
 * @param value - Any value
 * @returns true if serializable, false otherwise
 */
export function isSerializable(value: any): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes specific keys from an object.
 * @param obj - The original object
 * @param keysToOmit - Keys to exclude from the returned object
 * @returns A new object with the specified keys removed
 */
export function omitKeys<T extends Record<string, any>>(obj: T, keysToOmit: string[]): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !keysToOmit.includes(key))) as Partial<T>;
}

/**
 * Creates or gets a child span from existing tracing context or starts a new trace.
 * This helper consolidates the common pattern of creating spans that can either be:
 * 1. Children of an existing span (when tracingContext.currentSpan exists)
 * 2. New root spans (when no current span exists)
 *
 * @param options - Configuration object for span creation
 * @returns The created AI span or undefined if tracing is disabled
 */
export function getOrCreateSpan<T extends AISpanType>(options: {
  type: T;
  name: string;
  input?: any;
  attributes?: AISpanTypeMap[T];
  metadata?: Record<string, any>;
  tracingContext?: TracingContext;
  runtimeContext?: RuntimeContext;
}): AISpan<T> | undefined {
  const { type, attributes, tracingContext, runtimeContext, ...rest } = options;

  // If we have a current span, create a child span
  if (tracingContext?.currentSpan) {
    return tracingContext.currentSpan.createChildSpan({
      type,
      attributes,
      ...rest,
    });
  }

  // Otherwise, try to create a new root span
  const aiTracing = getSelectedAITracing({
    runtimeContext: runtimeContext,
  });

  return aiTracing?.startSpan({
    type,
    attributes,
    startOptions: {
      runtimeContext,
    },
    ...rest,
  });
}
