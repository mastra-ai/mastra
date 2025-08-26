import { context as otlpContext, SpanStatusCode, trace, propagation, context } from '@opentelemetry/api';
import type { Tracer, SpanOptions, Context, Span, BaggageEntry } from '@opentelemetry/api';

import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { OtelConfig } from './types';
import { getBaggageValues, hasActiveTelemetry } from './utility';

// Add type declaration for global namespace
declare global {
  var __TELEMETRY__: Telemetry | undefined;
}

export class Telemetry {
  public tracer: Tracer = trace.getTracer('default');
  name: string = 'default-service';

  private constructor(config: OtelConfig) {
    this.name = config.serviceName ?? 'default-service';

    this.tracer = trace.getTracer(this.name);
  }

  /**
   * @deprecated This method does not do anything
   */
  public async shutdown() {}

  /**
   * Initialize telemetry with the given configuration
   * @param config - Optional telemetry configuration object
   * @returns Telemetry instance that can be used for tracing
   */
  static init(config: OtelConfig = {}): Telemetry {
    try {
      if (!globalThis.__TELEMETRY__) {
        globalThis.__TELEMETRY__ = new Telemetry(config);
      }

      return globalThis.__TELEMETRY__;
    } catch (error) {
      const wrappedError = new MastraError(
        {
          id: 'TELEMETRY_INIT_FAILED',
          text: 'Failed to initialize telemetry',
          domain: ErrorDomain.MASTRA_TELEMETRY,
          category: ErrorCategory.SYSTEM,
        },
        error,
      );
      throw wrappedError;
    }
  }

  static getActiveSpan() {
    const span = trace.getActiveSpan();
    return span;
  }

  /**
   * Get the global telemetry instance
   * @throws {Error} If telemetry has not been initialized
   * @returns {Telemetry} The global telemetry instance
   */
  static get(): Telemetry {
    if (!globalThis.__TELEMETRY__) {
      throw new MastraError({
        id: 'TELEMETRY_GETTER_FAILED_GLOBAL_TELEMETRY_NOT_INITIALIZED',
        text: 'Telemetry not initialized',
        domain: ErrorDomain.MASTRA_TELEMETRY,
        category: ErrorCategory.USER,
      });
    }
    return globalThis.__TELEMETRY__;
  }

  /**
   * Wraps a class instance with telemetry tracing
   * @param instance The class instance to wrap
   * @param options Optional configuration for tracing
   * @returns Wrapped instance with all methods traced
   */
  traceClass<T extends object>(
    instance: T,
    options: {
      /** Base name for spans (e.g. 'integration', 'agent') */
      spanNamePrefix?: string;
      /** Additional attributes to add to all spans */
      attributes?: Record<string, string>;
      /** Methods to exclude from tracing */
      excludeMethods?: string[];
      /** Skip tracing if telemetry is not active */
      skipIfNoTelemetry?: boolean;
    } = {},
  ): T {
    const { skipIfNoTelemetry = true } = options;

    // Skip if no telemetry is active and skipIfNoTelemetry is true
    if (skipIfNoTelemetry && !hasActiveTelemetry()) {
      return instance;
    }

    const { spanNamePrefix = instance.constructor.name.toLowerCase(), attributes = {}, excludeMethods = [] } = options;

    return new Proxy(instance, {
      get: (target, prop: string | symbol) => {
        const value = target[prop as keyof T];

        // Skip tracing for excluded methods, constructors, private methods
        if (
          typeof value === 'function' &&
          prop !== 'constructor' &&
          !prop.toString().startsWith('_') &&
          !excludeMethods.includes(prop.toString())
        ) {
          return this.traceMethod(value.bind(target), {
            spanName: `${spanNamePrefix}.${prop.toString()}`,
            attributes: {
              ...attributes,
              [`${spanNamePrefix}.name`]: target.constructor.name,
              [`${spanNamePrefix}.method.name`]: prop.toString(),
            },
          });
        }

        return value;
      },
    });
  }

  static setBaggage(baggage: Record<string, BaggageEntry>, ctx: Context = otlpContext.active()) {
    const currentBaggage = Object.fromEntries(propagation.getBaggage(ctx)?.getAllEntries() ?? []);
    const newCtx = propagation.setBaggage(
      ctx,
      propagation.createBaggage({
        ...currentBaggage,
        ...baggage,
      }),
    );
    return newCtx;
  }

  static withContext(ctx: Context, fn: () => void) {
    return otlpContext.with(ctx, fn);
  }

  /**
   * method to trace individual methods with proper context
   * @param method The method to trace
   * @param context Additional context for the trace
   * @returns Wrapped method with tracing
   */
  traceMethod<TMethod extends Function>(
    method: TMethod,
    context: {
      spanName: string;
      attributes?: Record<string, string>;
      skipIfNoTelemetry?: boolean;
      parentSpan?: Span;
    },
  ): TMethod {
    let ctx = otlpContext.active();
    const { skipIfNoTelemetry = true } = context;

    // Skip if no telemetry is active and skipIfNoTelemetry is true
    if (skipIfNoTelemetry && !hasActiveTelemetry()) {
      return method;
    }

    return ((...args: unknown[]) => {
      const span = this.tracer.startSpan(context.spanName);

      function handleError(error: unknown) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.end();
        throw error;
      }
      try {
        const { requestId, componentName, runId, threadId, resourceId } = getBaggageValues(ctx);

        // Add all context attributes to span
        if (context.attributes) {
          span.setAttributes(context.attributes);
        }

        if (requestId) {
          span.setAttribute('http.request_id', requestId);
        }

        if (threadId) {
          span.setAttribute('threadId', threadId);
        }

        if (resourceId) {
          span.setAttribute('resourceId', resourceId);
        }

        if (context.attributes?.componentName) {
          ctx = propagation.setBaggage(
            ctx,
            propagation.createBaggage({
              componentName: { value: context.attributes.componentName },
              // @ts-ignore
              runId: { value: context.attributes.runId },
              // @ts-ignore
              'http.request_id': { value: requestId },
            }),
          );
        } else {
          if (componentName) {
            span.setAttribute('componentName', componentName);
            // @ts-ignore
            span.setAttribute('runId', runId);
          } else if (this && this.name) {
            span.setAttribute('componentName', this.name);
            // @ts-ignore
            span.setAttribute('runId', this.runId);
            ctx = propagation.setBaggage(
              ctx,
              propagation.createBaggage({
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
        }

        // Record input arguments as span attributes
        args.forEach((arg, index) => {
          try {
            span.setAttribute(`${context.spanName}.argument.${index}`, JSON.stringify(arg));
          } catch {
            span.setAttribute(`${context.spanName}.argument.${index}`, '[Not Serializable]');
          }
        });

        let result: any;
        otlpContext.with(trace.setSpan(ctx, span), () => {
          result = method(...args);
        });

        function recordResult(res: any) {
          try {
            span.setAttribute(`${context.spanName}.result`, JSON.stringify(res));
          } catch {
            span.setAttribute(`${context.spanName}.result`, '[Not Serializable]');
          }

          span.end();

          return res;
        }

        if (result instanceof Promise) {
          return result.then(recordResult).catch(handleError);
        } else {
          return recordResult(result);
        }
      } catch (error) {
        handleError(error);
      }
    }) as unknown as TMethod;
  }

  getBaggageTracer(): Tracer {
    return new BaggageTracer(this.tracer);
  }
}

class BaggageTracer implements Tracer {
  private _tracer: Tracer;

  constructor(tracer: Tracer) {
    this._tracer = tracer;
  }

  startSpan(name: string, options: SpanOptions = {}, ctx: Context) {
    ctx = ctx ?? otlpContext.active();
    const span = this._tracer.startSpan(name, options, ctx);
    const { componentName, runId, requestId, threadId, resourceId } = getBaggageValues(ctx);
    // @ts-ignore
    span.setAttribute('componentName', componentName);
    // @ts-ignore
    span.setAttribute('runId', runId);
    // @ts-ignore
    span.setAttribute('http.request_id', requestId);
    // @ts-ignore
    span.setAttribute('threadId', threadId);
    // @ts-ignore
    span.setAttribute('resourceId', resourceId);

    return span;
  }

  startActiveSpan<F extends (span: Span) => unknown>(name: string, fn: F): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(name: string, options: SpanOptions, fn: F): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    options: SpanOptions,
    ctx: Context,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    optionsOrFn: SpanOptions | F,
    ctxOrFn?: Context | F,
    fn?: F,
  ): ReturnType<F> {
    if (typeof optionsOrFn === 'function') {
      const wrappedFn = (span: Span) => {
        const { componentName, runId, requestId, threadId, resourceId } = getBaggageValues(otlpContext.active());
        // @ts-ignore
        span.setAttribute('componentName', componentName);
        // @ts-ignore
        span.setAttribute('runId', runId);
        // @ts-ignore
        span.setAttribute('http.request_id', requestId);
        // @ts-ignore
        span.setAttribute('threadId', threadId);
        // @ts-ignore
        span.setAttribute('resourceId', resourceId);

        return optionsOrFn(span);
      };
      return this._tracer.startActiveSpan(name, {}, context.active(), wrappedFn as F);
    }
    if (typeof ctxOrFn === 'function') {
      const wrappedFn = (span: Span) => {
        const { componentName, runId, requestId, threadId, resourceId } = getBaggageValues(otlpContext.active());
        // @ts-ignore
        span.setAttribute('componentName', componentName);
        // @ts-ignore
        span.setAttribute('runId', runId);
        // @ts-ignore
        span.setAttribute('http.request_id', requestId);
        // @ts-ignore
        span.setAttribute('threadId', threadId);
        // @ts-ignore
        span.setAttribute('resourceId', resourceId);

        return ctxOrFn(span);
      };
      return this._tracer.startActiveSpan(name, optionsOrFn, context.active(), wrappedFn as F);
    }
    const wrappedFn = (span: Span) => {
      const { componentName, runId, requestId, threadId, resourceId } = getBaggageValues(
        ctxOrFn ?? otlpContext.active(),
      );
      // @ts-ignore
      span.setAttribute('componentName', componentName);
      // @ts-ignore
      span.setAttribute('runId', runId);
      // @ts-ignore
      span.setAttribute('http.request_id', requestId);
      // @ts-ignore
      span.setAttribute('threadId', threadId);
      // @ts-ignore
      span.setAttribute('resourceId', resourceId);

      return fn!(span);
    };
    return this._tracer.startActiveSpan(name, optionsOrFn, ctxOrFn!, wrappedFn as F);
  }
}
