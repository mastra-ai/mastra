/**
 * Telemetry Decorators for Mastra
 * 
 * Provides decorator-based instrumentation that integrates with the new
 * MastraAITelemetry abstract base class.
 */

import type { DecoratorOptions } from './types';
import { SpanType } from './types';
import { getTelemetry } from './registry';

// ============================================================================
// Decorator Functions
// ============================================================================

/**
 * Method decorator for tracing individual methods
 */
export function withSpan(options: DecoratorOptions = {}) {
  return function (_target: any, propertyKey: string | symbol, descriptor?: PropertyDescriptor | number) {
    if (!descriptor || typeof descriptor === 'number') {
      return;
    }

    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);

    descriptor.value = function (...args: any[]) {
      const telemetry = getTelemetry();

      // Skip if no telemetry is available
      if (!telemetry?.isEnabled()) {
        return originalMethod.apply(this, args);
      }

      if (!telemetry) {
        // No telemetry available - execute method without tracing
        return originalMethod.apply(this, args);
      }

      // Determine span configuration
      const spanName = options.spanName || methodName;
      const spanType = options.spanType || SpanType.GENERIC;

      // Create traced method
      const tracedMethod = telemetry.traceMethod(originalMethod.bind(this), {
        spanName,
        spanType,
        attributes: options.attributes,
      });

      return tracedMethod(...args);
    };

    return descriptor;
  };
}

/**
 * Class decorator for automatically tracing all methods in a class
 */
export function InstrumentClass(options: {
  /** Prefix for span names */
  prefix?: string;
  /** Default span type for all methods */
  spanType?: SpanType;
  /** Methods to exclude from tracing */
  excludeMethods?: string[];
  /** Method filter function for more complex exclusion logic */
  methodFilter?: (methodName: string) => boolean;
  /** Telemetry instance name to use */
  telemetryName?: string;
} = {}) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const methods = Object.getOwnPropertyNames(constructor.prototype);

    methods.forEach(method => {
      // Skip excluded methods and constructor
      if (options.excludeMethods?.includes(method) || method === 'constructor') {
        return;
      }

      // Apply method filter if provided
      if (options.methodFilter && !options.methodFilter(method)) {
        return;
      }

      const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, method);
      if (descriptor && typeof descriptor.value === 'function') {
        // Apply withSpan decorator to each method
        const spanName = options.prefix ? `${options.prefix}.${method}` : method;
        
        Object.defineProperty(
          constructor.prototype,
          method,
          withSpan({
            spanName,
            spanType: options.spanType || SpanType.GENERIC,
          })(constructor.prototype, method, descriptor) || descriptor
        );
      }
    });

    return constructor;
  };
}


// ============================================================================
// Utility Functions
// ============================================================================


