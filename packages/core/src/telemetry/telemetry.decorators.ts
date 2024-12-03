import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Decorator factory that takes optional spanName
export function withSpan(options: {
  spanName?: string;
  skipIfNoTelemetry?: boolean;
  spanKind?: SpanKind;
}): any {
  return function (
    _target: any,
    propertyKey: string | symbol,
    descriptor?: PropertyDescriptor | number
  ) {
    if (!descriptor || typeof descriptor === 'number') return;

    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);

    descriptor.value = function (...args: any[]) {
      const tracer = trace.getTracer('default-tracer');

      // Determine span name and kind
      let spanName: string;
      let spanKind: SpanKind | undefined;

      if (typeof options === 'string') {
        spanName = options;
      } else if (options) {
        spanName = options.spanName || methodName;
        spanKind = options.spanKind;
      } else {
        spanName = methodName;
      }

      // Start the span with optional kind
      const span = tracer.startSpan(spanName, { kind: spanKind });
      const ctx = trace.setSpan(context.active(), span);

      let result;
      try {
        // Call the original method within the context
        result = context.with(ctx, () => originalMethod.apply(this, args));

        // Handle promises
        if (result instanceof Promise) {
          return result.finally(() => span.end());
        }

        // Return regular results
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        // End span for non-promise returns
        if (!(result instanceof Promise)) {
          span.end();
        }
      }
    };

    return descriptor;
  };
}

// class-telemetry.decorator.ts
export function InstrumentClass() {
  return function (target: any) {
    // Get all method names of the class
    const methods = Object.getOwnPropertyNames(target.prototype);

    methods.forEach((method) => {
      // Skip constructor
      if (method === 'constructor') return;

      const descriptor = Object.getOwnPropertyDescriptor(
        target.prototype,
        method
      );
      if (descriptor && typeof descriptor.value === 'function') {
        // Apply withSpan decorator to each method
        Object.defineProperty(
          target.prototype,
          method,
          withSpan({
            spanName: method,
            skipIfNoTelemetry: true,
          })(target, method, descriptor)
        );
      }
    });

    return target;
  };
}
