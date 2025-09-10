/**
 * Utility functions for cleaning and manipulating metadata objects
 * used in AI tracing and observability.
 */

import type { RuntimeContext } from '../di';
import { getSelectedAITracing } from './registry';
import type { AISpan, AISpanType, AISpanTypeMap, AnyAISpan, TracingContext, TracingOptions } from './types';

const DEFAULT_KEYS_TO_STRIP = new Set(['logger', 'providerMetadata', 'steps', 'tracingContext']);
export interface DeepCleanOptions {
  keysToStrip?: Set<string>;
  maxDepth?: number;
}

/**
 * Recursively cleans a value by removing circular references and stripping problematic or sensitive keys.
 * Circular references are replaced with "[Circular]". Unserializable values are replaced with error messages.
 * Keys like "logger" and "tracingContext" are stripped by default.
 * A maximum recursion depth is enforced to avoid stack overflow or excessive memory usage.
 *
 * @param value - The value to clean (object, array, primitive, etc.)
 * @param options - Optional configuration:
 *   - keysToStrip: Set of keys to remove from objects (default: logger, tracingContext)
 *   - maxDepth: Maximum recursion depth before values are replaced with "[MaxDepth]" (default: 10)
 * @returns A cleaned version of the input with circular references, specified keys, and overly deep values handled
 */
export function deepClean(
  value: any,
  options: DeepCleanOptions = {},
  _seen: WeakSet<any> = new WeakSet(),
  _depth: number = 0,
): any {
  const { keysToStrip = DEFAULT_KEYS_TO_STRIP, maxDepth = 10 } = options;

  if (_depth > maxDepth) {
    return '[MaxDepth]';
  }

  if (value === null || typeof value !== 'object') {
    try {
      JSON.stringify(value);
      return value;
    } catch (error) {
      return `[${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  if (_seen.has(value)) {
    return '[Circular]';
  }

  _seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => deepClean(item, options, _seen, _depth + 1));
  }

  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    if (keysToStrip.has(key)) {
      continue;
    }

    try {
      cleaned[key] = deepClean(val, options, _seen, _depth + 1);
    } catch (error) {
      cleaned[key] = `[${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  return cleaned;
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
 * Selectively extracts specific fields from an object using dot notation.
 * Does not error if fields don't exist - simply omits them from the result.
 * @param obj - The source object to extract fields from
 * @param fields - Array of field paths (supports dot notation like 'output.text')
 * @returns New object containing only the specified fields
 */
export function selectFields(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: any = {};

  for (const field of fields) {
    const value = getNestedValue(obj, field);
    if (value !== undefined) {
      setNestedValue(result, field, value);
    }
  }

  return result;
}

/**
 * Gets a nested value from an object using dot notation
 * @param obj - Source object
 * @param path - Dot notation path (e.g., 'output.text')
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' ? current[key] : undefined;
  }, obj);
}

/**
 * Sets a nested value in an object using dot notation
 * @param obj - Target object
 * @param path - Dot notation path (e.g., 'output.text')
 * @param value - Value to set
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop();
  if (!lastKey) {
    return;
  }

  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key];
  }, obj);

  target[lastKey] = value;
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
  tracingOptions?: TracingOptions;
  runtimeContext?: RuntimeContext;
}): AISpan<T> | undefined {
  const { type, attributes, tracingContext, tracingOptions, runtimeContext, ...rest } = options;

  const metadata = {
    ...(rest.metadata ?? {}),
    ...(tracingOptions?.metadata ?? {}),
  };

  // If we have a current span, create a child span
  if (tracingContext?.currentSpan) {
    return tracingContext.currentSpan.createChildSpan({
      type,
      attributes,
      ...rest,
      metadata,
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
    metadata,
  });
}

/**
 * Extracts the trace ID from a span if it is valid.
 *
 * This helper is typically used to safely retrieve the `traceId` from a span object,
 * while gracefully handling invalid spans — such as no-op spans — by returning `undefined`.
 *
 * A span is considered valid if `span.isValid` is `true`.
 *
 * @param span - The span object to extract the trace ID from. May be `undefined`.
 * @returns The `traceId` if the span is valid, otherwise `undefined`.
 */
export function getValidTraceId(span?: AnyAISpan): string | undefined {
  return span?.isValid ? span.traceId : undefined;
}
