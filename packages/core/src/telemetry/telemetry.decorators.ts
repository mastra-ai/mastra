import { trace, context, SpanStatusCode, SpanKind, propagation } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';

import { hasActiveTelemetry, getBaggageValues } from './utility';

// Type interfaces for better type safety
interface StreamFinishData {
  text?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  warnings?: unknown;
  object?: unknown; // For structured output
}

interface StreamOptions {
  onFinish?: (data: StreamFinishData) => Promise<void> | void;
  [key: string]: unknown;
}

interface EnhancedSpan extends Span {
  __mastraStreamingSpan?: boolean;
}

function isStreamingResult(result: unknown, methodName: string): boolean {
  if (methodName === 'stream' || methodName === 'streamVNext') {
    return true;
  }

  if (result && typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;
    return 'textStream' in obj || 'objectStream' in obj || 'usagePromise' in obj || 'finishReasonPromise' in obj;
  }

  return false;
}

function enhanceStreamingArgumentsWithTelemetry(
  args: unknown[],
  span: EnhancedSpan,
  spanName: string,
  methodName: string,
): unknown[] {
  if (methodName === 'stream' || methodName === 'streamVNext') {
    const enhancedArgs = [...args];
    const streamOptions = (enhancedArgs.length > 1 && (enhancedArgs[1] as StreamOptions)) || ({} as StreamOptions);
    const enhancedStreamOptions: StreamOptions = { ...streamOptions };
    const originalOnFinish = enhancedStreamOptions.onFinish;

    enhancedStreamOptions.onFinish = async (finishData: StreamFinishData) => {
      try {
        const telemetryData = {
          text: finishData.text,
          usage: finishData.usage,
          finishReason: finishData.finishReason,
          toolCalls: finishData.toolCalls,
          toolResults: finishData.toolResults,
          warnings: finishData.warnings,
          ...(finishData.object !== undefined && { object: finishData.object }),
        };

        span.setAttribute(`${spanName}.result`, JSON.stringify(telemetryData));
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      } catch (error) {
        debugger;
        console.warn('Telemetry capture failed:', error);
        span.setAttribute(`${spanName}.result`, '[Telemetry Capture Error]');
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
      }

      if (originalOnFinish) {
        return await originalOnFinish(finishData);
      }
    };

    // Check if an original onFinish was passed
    (enhancedStreamOptions.onFinish as any).__hasOriginalOnFinish = !!originalOnFinish;

    enhancedArgs[1] = enhancedStreamOptions;
    span.__mastraStreamingSpan = true;

    return enhancedArgs;
  }

  return args;
}

// Decorator factory that takes optional spanName
export function withSpan(options: {
  spanName?: string;
  skipIfNoTelemetry?: boolean;
  spanKind?: SpanKind;
  tracerName?: string;
}): any {
  return function (_target: any, propertyKey: string | symbol, descriptor?: PropertyDescriptor | number) {
    if (!descriptor || typeof descriptor === 'number') return;

    const originalMethod = descriptor.value as Function;
    const methodName = String(propertyKey);

    descriptor.value = function (this: unknown, ...args: unknown[]) {
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
      const span = tracer.startSpan(spanName, { kind: spanKind }) as EnhancedSpan;
      let ctx = trace.setSpan(context.active(), span);

      // Record input arguments as span attributes
      args.forEach((arg, index) => {
        try {
          span.setAttribute(`${spanName}.argument.${index}`, JSON.stringify(arg));
        } catch {
          span.setAttribute(`${spanName}.argument.${index}`, '[Not Serializable]');
        }
      });

      const { requestId, componentName, runId, threadId, resourceId } = getBaggageValues(ctx);
      if (requestId) {
        span.setAttribute('http.request_id', requestId);
      }

      if (threadId) {
        span.setAttribute('threadId', threadId);
      }

      if (resourceId) {
        span.setAttribute('resourceId', resourceId);
      }

      if (componentName) {
        span.setAttribute('componentName', componentName);
        // @ts-ignore - These properties may exist on the context
        span.setAttribute('runId', runId);
      } else if (this && typeof this === 'object' && 'name' in this) {
        const contextObj = this as { name: string; runId?: string };
        span.setAttribute('componentName', contextObj.name);
        if (contextObj.runId) {
          span.setAttribute('runId', contextObj.runId);
        }
        ctx = propagation.setBaggage(
          ctx,
          propagation.createBaggage({
            // @ts-ignore
            componentName: { value: this.name },
            // @ts-ignore
            runId: { value: this.runId },
            // @ts-ignore
            'http.request_id': { value: requestId },
            // @ts-ignore
            threadId: { value: threadId },
            // @ts-ignore
            resourceId: { value: resourceId },
          }),
        );
      }

      let result: unknown;
      try {
        // For streaming methods, enhance arguments with telemetry capture before calling
        const enhancedArgs = isStreamingResult(result, methodName)
          ? enhanceStreamingArgumentsWithTelemetry(args, span, spanName, methodName)
          : args;

        // Call the original method within the context
        result = context.with(ctx, () => originalMethod.apply(this, enhancedArgs));

        // Handle promises
        if (result instanceof Promise) {
          return result
            .then(resolvedValue => {
              if (isStreamingResult(resolvedValue, methodName)) {
                return resolvedValue;
              } else {
                try {
                  span.setAttribute(`${spanName}.result`, JSON.stringify(resolvedValue));
                } catch {
                  span.setAttribute(`${spanName}.result`, '[Not Serializable]');
                }
                return resolvedValue;
              }
            })
            .finally(() => {
              if (!span.__mastraStreamingSpan) {
                span.end();
              }
            });
        }

        // Record result for non-promise returns
        if (!isStreamingResult(result, methodName)) {
          try {
            span.setAttribute(`${spanName}.result`, JSON.stringify(result));
          } catch {
            span.setAttribute(`${spanName}.result`, '[Not Serializable]');
          }
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
        if (!(result instanceof Promise) && !isStreamingResult(result, methodName)) {
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
