/**
 * Default Implementation for MastraTelemetry
 *
 * This is the default in-memory implementation that extends the MastraTelemetry
 * abstract base class. Following Mastra's naming conventions, it provides:
 * - DefaultAISpan: Basic span implementation with lifecycle management
 * - DefaultTrace: Basic trace implementation with status tracking
 * - DefaultConsoleExporter: Development-friendly console output
 * - DefaultTelemetry: Main telemetry implementation
 */

import { MastraError } from '../error';
import { MastraAITelemetry } from './base';
import {
  type AISpan,
  type SpanOptions,
  type TracingOptions,
  type SpanMetadata,
  SpanType,
  type TelemetryExporter,
  type TelemetryConfig,
  type BaseMetadata,
} from './types';

// ============================================================================
// Default AISpan Implementation
// ============================================================================

function generateId(): string {
  return `span-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

class DefaultAISpan implements AISpan<BaseMetadata> {
  public id: string;
  public name: string;
  public type: SpanType;
  public metadata: SpanMetadata;
  public children: AISpan<SpanMetadata>[] = [];
  public parent?: AISpan<SpanMetadata>;
  public trace: AISpan<SpanMetadata>;
  public startTime: Date;
  public endTime?: Date;

  constructor(options: SpanOptions) {
    this.id = generateId();
    this.name = options.name;
    this.type = options.type;
    this.metadata = options.metadata;
    this.parent = options.parent;
    this.trace = options.parent ? options.parent.trace : this;
    this.startTime = new Date();

    // Add to parent's children if we have a parent
    if (this.parent) {
      this.parent.children.push(this);
    }
  }

  end(metadata?: Partial<BaseMetadata>): void {
    this.endTime = new Date();
    if (metadata) {
      this.metadata = { ...this.metadata, ...metadata };
    }
    // Callback will be set up by base class createSpanWithCallbacks
  }

  // TODO: could endSpan be default = true?
  error(error: MastraError | Error, endSpan: boolean): void {
    const metadata = (error instanceof(MastraError)) ? {
      error : {
        id: error.id,
        details: error.details,
        category: error.category,
        domain: error.domain,
        message: error.message,
      }
    } : {
      error: {
        message: error.message,
      }
    }

    if (endSpan) {
      this.end(metadata)
    } else {
      this.update(metadata)
    }
  }

  createChildSpan(options: SpanOptions): AISpan {
    options.parent = this;
    //TODO: NEED TO FIGURE OUT HOW TO WRAP THIS WITH EVENTS
    return new DefaultAISpan(options);
  }

  update(metadata: BaseMetadata): void {
    this.metadata = { ...this.metadata, ...metadata };
    // Callback will be set up by base class createSpanWithCallbacks
  }

  async export(): Promise<string> {
    return JSON.stringify({
      id: this.id,
      metadata: this.metadata,
      startTime: this.startTime,
      endTime: this.endTime,
      parentId: this.parent?.id,
      traceId: this.trace.id,
    });
  }
}

// ============================================================================
// Default Console Exporter
// ============================================================================

export class DefaultConsoleExporter implements TelemetryExporter {
  name = 'default-console';

  async exportEvent(event: import('./types').TelemetryEvent): Promise<void> {
    const timestamp = new Date().toISOString();

    switch (event.type) {
      case 'span_started':
        console.log(
          `[${timestamp}] SPAN_STARTED: ${event.span.type} (${event.span.id}) in trace ${event.span.trace.id}`,
        );
        break;
      case 'span_ended':
        const span = event.span as DefaultAISpan;
        const duration = span.endTime && span.startTime ? span.endTime.getTime() - span.startTime.getTime() : 0;
        console.log(`[${timestamp}] SPAN_ENDED: ${span.type} (${span.id}) - Duration: ${duration}ms`);
        break;
      case 'span_updated':
        console.log(`[${timestamp}] SPAN_UPDATED: ${event.span.type} (${event.span.id})`);
        break;
      default:
        console.log(`[${timestamp}] UNKNOWN_EVENT:`, event);
    }
  }

  async shutdown(): Promise<void> {
    console.log('[TELEMETRY] DefaultConsoleExporter shutdown');
  }
}

// ============================================================================
// Default Telemetry Implementation
// ============================================================================

export class DefaultTelemetry extends MastraAITelemetry {
  private traces = new Map<string, AISpan>();

  constructor(config: { name: string } & TelemetryConfig = { name: 'default-telemetry' }) {
    // Add console exporter by default if none provided
    if (!config.exporters || config.exporters.length === 0) {
      config.exporters = [new DefaultConsoleExporter()];
    }

    super(config);
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================


  protected _startSpan(options: SpanOptions): AISpan {
    const spanId = generateId();

    const metadata: SpanMetadata = options.metadata as SpanMetadata;

    // Use the createSpanWithCallbacks helper to wire up lifecycle callbacks
    return this.createSpanWithCallbacks(options, () => {
      return new DefaultAISpan(options);
    });
  }

  protected _traceClass<T extends object>(instance: T, options?: TracingOptions): T {
    const {
      spanNamePrefix = instance.constructor.name.toLowerCase(),
      defaultSpanType = SpanType.GENERIC,
      excludeMethods = ['constructor', '__setTelemetry', '__setLogger'],
      attributes = {},
    } = options || {};

    return new Proxy(instance, {
      get: (target, prop: string | symbol) => {
        const value = target[prop as keyof T];

        // Skip tracing for excluded methods and private methods
        if (
          typeof value === 'function' &&
          !prop.toString().startsWith('_') &&
          !excludeMethods.includes(prop.toString())
        ) {
          return this._traceMethod(value.bind(target), {
            spanName: `${spanNamePrefix}.${prop.toString()}`,
            spanType: defaultSpanType,
            metadata: {
                attributes: {
                ...attributes,
                'method.name': prop.toString(),
                'class.name': target.constructor.name,
              },
            },
          });
        }

        return value;
      },
    });
  }

  protected _traceMethod<TMethod extends Function>(
    method: TMethod,
    options: {
      spanName: string;
      spanType?: SpanType;
      metadata?: SpanMetadata;
    },
  ): TMethod {
    const { spanName, spanType = SpanType.GENERIC, metadata = {} } = options;

    return ((...args: unknown[]) => {
      // Create span using strongly-typed API
      const span = this.startSpan<SpanMetadata>({
        name: spanName,
        type: spanType,
        metadata,
        // TODO: try to get calling method somehow to pull parent:
        // parent
      });

      try {
        // Record input arguments (safely)
        args.forEach((arg, index) => {
          try {
            const serialized = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
            span.update({
              attributes: {
                ...span.metadata.attributes,
                [`argument.${index}`]: serialized.slice(0, 1000), // Limit size
              },
            });
          } catch {
            // Skip if can't serialize
          }
        });

        const result = method(...args);

        // Handle promises
        if (result instanceof Promise) {
          return result
            .then(resolvedValue => {
              try {
                const serialized =
                  typeof resolvedValue === 'object' ? JSON.stringify(resolvedValue) : String(resolvedValue);
                span.update({
                  attributes: {
                    ...span.metadata.attributes,
                    result: serialized.slice(0, 1000), // Limit size
                  },
                });
              } catch {
                // Skip if can't serialize
              }
              return resolvedValue;
            })
            .catch(error => {
              span.error(error, false)
              throw error;
            })
            .finally(() => {
              span.end();
            });
        }

        // Handle synchronous results
        try {
          const serialized = typeof result === 'object' ? JSON.stringify(result) : String(result);
          span.update({
            attributes: {
              ...span.metadata.attributes,
              result: serialized.slice(0, 1000), // Limit size
            },
          });
        } catch {
          // Skip if can't serialize
        }

        span.end();
        return result;
      } catch (error: any) {
        span.error(error, true)
        throw error;
      }
    }) as unknown as TMethod;
  }

  withSpan<T>(span: AISpan, fn: () => T): T {
    // Simple implementation - just execute the function
    // A more sophisticated implementation would set up async context
    return fn();
  }

  // ============================================================================
  // Additional Helper Methods
  // ============================================================================


  /**
   * Get all traces
   */
  getAllTraces(): AISpan[] {
    return Array.from(this.traces.values());
  }

  /**
   * Clear all traces (useful for testing)
   */
  clearTraces(): void {
    this.traces.clear();
  }
}
