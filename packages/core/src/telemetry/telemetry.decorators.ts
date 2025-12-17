import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';

import { boundedStringify } from '../ai-tracing/serialization';
import { getBaggageValues, hasActiveTelemetry } from './utility';

interface StreamFinishData {
  text?: string;
  usage?: {
    // AI SDK v5 format (VNext paths)
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
    // Legacy format (backward compatibility)
    promptTokens?: number;
    completionTokens?: number;
    // Common fields
    totalTokens?: number;
  };
  finishReason?: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  warnings?: unknown;
  object?: unknown; // structured output
}

interface StreamOptions {
  onFinish?: (data: StreamFinishData) => Promise<void> | void;
  [key: string]: unknown;
}

interface EnhancedSpan extends Span {
  __mastraStreamingSpan?: boolean;
  __mastraEnded?: boolean;
}

/**
 * End a span at most once (guards against double-end bugs across layers).
 */
function endSpanOnce(span: EnhancedSpan) {
  if (span.__mastraEnded) return;
  span.__mastraEnded = true;
  try {
    span.end();
  } catch {
    // best-effort
  }
}

function isStreamingMethod(methodName: string): boolean {
  return methodName === 'stream' || methodName === 'streamLegacy';
}

/**
 * Attach minimal finish data to a span for streaming methods.
 * Default behavior stores only SMALL summary fields to avoid OOM.
 */
function enhanceStreamingArgumentsWithTelemetry(args: unknown[], span: EnhancedSpan, spanName: string): unknown[] {
  const enhancedArgs = [...args];

  // Typical AI SDK signature: (model, options?) OR (prompt, options?)
  const streamOptions = (enhancedArgs.length > 1 && (enhancedArgs[1] as StreamOptions)) || ({} as StreamOptions);
  const enhancedStreamOptions: StreamOptions = { ...streamOptions };

  const originalOnFinish = enhancedStreamOptions.onFinish;

  enhancedStreamOptions.onFinish = async (finishData: StreamFinishData) => {
    const telemetryData = {
      text: finishData.text,
      usage: finishData.usage,
      finishReason: finishData.finishReason,
      toolCalls: finishData.toolCalls,
      toolResults: finishData.toolResults,
      warnings: finishData.warnings,
      ...(finishData.object !== undefined && { object: finishData.object }),
    };

    span.setAttribute(`${spanName}.result`, boundedStringify(telemetryData));
    span.setStatus({ code: SpanStatusCode.OK });
    endSpanOnce(span);

    if (originalOnFinish) return await originalOnFinish(finishData);
  };

  (enhancedStreamOptions.onFinish as any).__hasOriginalOnFinish = !!originalOnFinish;

  enhancedArgs[1] = enhancedStreamOptions;
  span.__mastraStreamingSpan = true;
  return enhancedArgs;
}

// Decorator factory
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

      // Always bind span to the active context
      let ctx = trace.setSpan(context.active(), span);

      // Record input arguments with bounded serialization
      args.forEach((arg, index) => {
        span.setAttribute(`${spanName}.argument.${index}`, boundedStringify(arg));
      });

      // Attach baggage-derived fields (these should be small)
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
        if (runId) {
          span.setAttribute('runId', runId);
        }
      } else if (this && typeof this === 'object' && 'name' in this) {
        const contextObj = this as { name: string; runId?: string };
        span.setAttribute('componentName', contextObj.name);
        if (contextObj.runId) span.setAttribute('runId', contextObj.runId);

        // Best-effort baggage update, but do NOT inject undefined properties
        const baggageEntries: Record<string, { value: string }> = {};

        baggageEntries.componentName = { value: contextObj.name };

        if (contextObj.runId) {
          baggageEntries.runId = { value: contextObj.runId };
        }

        if (requestId) {
          baggageEntries['http.request_id'] = { value: requestId };
        }

        if (threadId) {
          baggageEntries.threadId = { value: threadId };
        }

        if (resourceId) {
          baggageEntries.resourceId = { value: resourceId };
        }

        ctx = propagation.setBaggage(ctx, propagation.createBaggage(baggageEntries as any));
      }

      try {
        // If this is a streaming method, wrap args before invocation
        const enhancedArgs = isStreamingMethod(methodName)
          ? enhanceStreamingArgumentsWithTelemetry(args, span, spanName)
          : args;

        const result = context.with(ctx, () => originalMethod.apply(this, enhancedArgs));

        // Promise
        if (result instanceof Promise) {
          return result
            .then(resolvedValue => {
              // For streaming, onFinish is responsible for ending span
              if (isStreamingMethod(methodName)) {
                return resolvedValue;
              }

              span.setAttribute(`${spanName}.result`, boundedStringify(resolvedValue));
              span.setStatus({ code: SpanStatusCode.OK });
              return resolvedValue;
            })
            .catch(err => {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err instanceof Error ? err.message : 'Unknown error',
              });
              if (err instanceof Error) {
                // recordException is okay, but can include stack; rely on OTel/Sentry settings
                span.recordException(err);
              }
              // End span on error - for streaming methods, onFinish won't be called if there's an error
              endSpanOnce(span);
              throw err;
            })
            .finally(() => {
              if (!span.__mastraStreamingSpan) endSpanOnce(span);
            });
        }

        // Non-promise return
        if (!isStreamingMethod(methodName)) {
          span.setAttribute(`${spanName}.result`, boundedStringify(result));
        }
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        // End span on error - for streaming methods, onFinish won't be called if there's an error
        endSpanOnce(span);
        throw error;
      } finally {
        // End span for sync non-streaming methods (streaming ends in onFinish or catch)
        if (!isStreamingMethod(methodName) && !span.__mastraEnded) {
          endSpanOnce(span);
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
      if (options?.excludeMethods?.includes(method) || method === 'constructor') return;
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
