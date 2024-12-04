import { SpanStatusCode, trace, Tracer } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

import { OtelConfig } from './types';
import { hasActiveTelemetry } from './utility';

export * from './types';
export * from './telemetry.decorators';
export * from './utility';

export class Telemetry {
  private static instance: Telemetry;
  private sdk: NodeSDK;
  public tracer: Tracer;

  private constructor(config: OtelConfig) {
    const exporter =
      config.export?.type === 'otlp'
        ? new OTLPTraceExporter({
            url: config.export.endpoint,
            headers: config.export.headers,
          })
        : new ConsoleSpanExporter();

    this.sdk = new NodeSDK({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: config.serviceName ?? 'default-service',
      }),
      traceExporter: exporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
        }),
      ],
    });

    this.sdk.start();
    this.tracer = trace.getTracer('my-library');

    process.on('SIGTERM', () => {
      this.sdk
        .shutdown()
        .catch(console.error)
        .finally(() => process.exit(0));
    });
  }

  /**
   * Initialize the telemetry instance
   * @param config Optional configuration for the telemetry instance
   * @returns The initialized telemetry instance
   */
  static init(config: OtelConfig = {}): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry(config);
    }
    return Telemetry.instance;
  }

  /**
   * Get the initialized telemetry instance
   * @returns The initialized telemetry instance
   * @throws Error if the telemetry instance is not initialized
   */
  static get(): Telemetry {
    if (!Telemetry.instance) {
      throw new Error('Telemetry not initialized');
    }
    return Telemetry.instance;
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
    } = {}
  ): T {
    const { skipIfNoTelemetry = true } = options;

    // Skip if no telemetry is active and skipIfNoTelemetry is true
    if (skipIfNoTelemetry && !hasActiveTelemetry()) {
      return instance;
    }

    const {
      spanNamePrefix = instance.constructor.name.toLowerCase(),
      attributes = {},
      excludeMethods = [],
    } = options;

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
    }
  ): TMethod {
    const { skipIfNoTelemetry = true } = context;

    // Skip if no telemetry is active and skipIfNoTelemetry is true
    if (skipIfNoTelemetry && !hasActiveTelemetry()) {
      return method;
    }

    return (async (...args: unknown[]) => {
      const span = this.tracer.startSpan(context.spanName);

      try {
        // Add all context attributes to span
        if (context.attributes) {
          span.setAttributes(context.attributes);
        }

        // Record input arguments as span attributes
        args.forEach((arg, index) => {
          try {
            span.setAttribute(
              `${context.spanName}.argument.${index}`,
              JSON.stringify(arg)
            );
          } catch (e) {
            span.setAttribute(
              `${context.spanName}.argument.${index}`,
              '[Not Serializable]'
            );
          }
        });

        const result = await method(...args);

        // Record result
        try {
          span.setAttribute(
            `${context.spanName}.result`,
            JSON.stringify(result)
          );
        } catch (e) {
          span.setAttribute(`${context.spanName}.result`, '[Not Serializable]');
        }

        span.end();
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.end();
        throw error;
      }
    }) as unknown as TMethod;
  }
}
