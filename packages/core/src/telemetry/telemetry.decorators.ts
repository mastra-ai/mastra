import { trace, context, SpanStatusCode, SpanKind, propagation } from '@opentelemetry/api';

import { hasActiveTelemetry } from './utility';

// Decorator factory that takes optional spanName
export function withSpan(options: {
  spanName?: string;
  skipIfNoTelemetry?: boolean;
  spanKind?: SpanKind;
  tracerName?: string;
}): any {
  return function (_target: any, propertyKey: string | symbol, descriptor?: PropertyDescriptor | number) {
    if (!descriptor || typeof descriptor === 'number') return;

    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);

    descriptor.value = function (...args: any[]) {
      // Skip if no telemetry is available and skipIfNoTelemetry is true
      if (options?.skipIfNoTelemetry && !hasActiveTelemetry(options?.tracerName)) {
        return originalMethod.apply(this, args);
      }

      const tracer = trace.getTracer(options?.tracerName ?? 'default-tracer');

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
      let ctx = trace.setSpan(context.active(), span);

      // Record input arguments as span attributes
      args.forEach((arg, index) => {
        try {
          span.setAttribute(`${spanName}.argument.${index}`, JSON.stringify(arg));
        } catch {
          span.setAttribute(`${spanName}.argument.${index}`, '[Not Serializable]');
        }
      });

      const currentBaggage = propagation.getBaggage(ctx);
      // @ts-ignore
      if (currentBaggage?.componentName) {
        // @ts-ignore
        span.setAttribute('componentName', currentBaggage?.componentName);
        // @ts-ignore
        span.setAttribute('runId', currentBaggage?.runId);
        // @ts-ignore
      } else if (this && this.name) {
        // @ts-ignore
        span.setAttribute('componentName', this.name);
        // @ts-ignore
        span.setAttribute('runId', this.runId);
        // @ts-ignore
        ctx = propagation.setBaggage(ctx, { componentName: this.name, runId: this.runId });
      }

      let result;
      try {
        // Call the original method within the context
        result = context.with(ctx, () => originalMethod.apply(this, args));

        // Handle promises
        if (result instanceof Promise) {
          return result
            .then(resolvedValue => {
              try {
                span.setAttribute(`${spanName}.result`, JSON.stringify(resolvedValue));
              } catch {
                span.setAttribute(`${spanName}.result`, '[Not Serializable]');
              }
              return resolvedValue;
            })
            .finally(() => span.end());
        }

        // Record result for non-promise returns
        try {
          span.setAttribute(`${spanName}.result`, JSON.stringify(result));
        } catch {
          span.setAttribute(`${spanName}.result`, '[Not Serializable]');
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
export function InstrumentClass(options?: {
  prefix?: string;
  spanKind?: SpanKind;
  excludeMethods?: string[];
  methodFilter?: (methodName: string) => boolean;
  tracerName?: string;
}) {
  return function (target: any) {
    const methods = Object.getOwnPropertyNames(target.prototype);

    methods.forEach(method => {
      // Skip excluded methods
      if (options?.excludeMethods?.includes(method) || method === 'constructor') return;
      // Apply method filter if provided
      if (options?.methodFilter && !options.methodFilter(method)) return;

      const descriptor = Object.getOwnPropertyDescriptor(target.prototype, method);
      if (descriptor && typeof descriptor.value === 'function') {
        Object.defineProperty(
          target.prototype,
          method,
          withSpan({
            spanName: options?.prefix ? `${options.prefix}.${method}` : method,
            skipIfNoTelemetry: true,
            spanKind: options?.spanKind || SpanKind.INTERNAL,
            tracerName: options?.tracerName,
          })(target, method, descriptor),
        );
      }
    });

    return target;
  };
}
