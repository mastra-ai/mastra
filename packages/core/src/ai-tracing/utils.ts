/**
 * Utility functions for cleaning and manipulating metadata objects
 * used in AI tracing and observability.
 */

import type { RuntimeContext } from '../di';
import { getSelectedAITracing } from './registry';
import type { AISpan, AISpanType, AISpanTypeMap, TracingContext } from './types';

/**
 * Cleans an object by testing each key-value pair for circular references.
 * Problematic values are replaced with error messages for debugging.
 * @param obj - Object to clean
 * @returns Cleaned object with circular references marked
 */
export function shallowCleanObject(obj: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    try {
      JSON.stringify(value);
      cleaned[key] = value;
    } catch (error) {
      // Use the actual error message for debugging
      cleaned[key] = `[${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  return cleaned;
}

/**
 * Cleans an array by applying object cleaning to each item.
 * @param arr - Array to clean
 * @returns Cleaned array with problematic items marked
 */
export function shallowCleanArray(arr: any[]): any[] {
  return arr.map(item => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      // Apply object cleaning to each array item
      return shallowCleanObject(item);
    }

    // For primitives, nested arrays, etc. - test directly
    try {
      JSON.stringify(item);
      return item;
    } catch (error) {
      return `[${error instanceof Error ? error.message : String(error)}]`;
    }
  });
}

/**
 * Safely cleans any value by removing circular references and marking problematic data.
 * Provides detailed error information to help identify issues in source code.
 * @param value - Value to clean (object, array, primitive, etc.)
 * @returns Cleaned value with circular references marked
 */
export function shallowClean(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return shallowCleanArray(value);
  }

  if (typeof value === 'object') {
    return shallowCleanObject(value);
  }

  // Primitives, functions, etc. - test directly
  try {
    JSON.stringify(value);
    return value;
  } catch (error) {
    return `[${error instanceof Error ? error.message : String(error)}]`;
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
