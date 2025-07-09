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

import { MastraTelemetry } from './base';
import {
  type Trace,
  type AISpan,
  type SpanOptions,
  type TracingOptions,
  type SpanMetadata,
  SpanType,
  type TelemetryExporter,
  type SharedTelemetryConfig,
  // Note: Individual metadata types are now part of TypedSpanOptions discriminated union
} from './types';

// ============================================================================
// Default AISpan Implementation
// ============================================================================

class DefaultAISpan implements AISpan {
  public id: string;
  public metadata: SpanMetadata;
  public children: AISpan[] = [];
  public parent?: AISpan;
  public trace: Trace;
  public startTime: Date;
  public endTime?: Date;

  constructor(options: { id: string; metadata: SpanMetadata; trace: Trace; parent?: AISpan }) {
    this.id = options.id;
    this.metadata = options.metadata;
    this.trace = options.trace;
    this.parent = options.parent;
    this.startTime = new Date();

    // Add to parent's children if we have a parent
    if (this.parent) {
      this.parent.children.push(this);
    }
  }

  end(options?: { endTime?: Date; metadata?: any }): void {
    this.endTime = options?.endTime || new Date();
    if (options?.metadata) {
      this.metadata = { ...this.metadata, ...options.metadata };
    }
    // Callback will be set up by base class createSpanWithCallbacks
  }

  createChildSpan(metadata: Omit<SpanMetadata, 'traceId' | 'parentSpanId' | 'createdAt'>): AISpan {
    const childId = `span-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const childMetadata: SpanMetadata = {
      ...metadata,
      traceId: this.trace.id,
      parentSpanId: this.id,
      createdAt: new Date(),
    } as SpanMetadata;

    return new DefaultAISpan({
      id: childId,
      metadata: childMetadata,
      trace: this.trace,
      parent: this,
    });
  }

  update(metadata: any): void {
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
// Default Trace Implementation
// ============================================================================

class DefaultTrace implements Trace {
  public id: string;
  public name: string;
  public startTime: Date;
  public endTime?: Date;
  public status: 'running' | 'completed' | 'failed' | 'cancelled' = 'running';
  public user?: { id?: string; sessionId?: string; [key: string]: any };
  public attributes?: Record<string, any>;
  public tags?: string[];
  public rootSpans: AISpan[] = [];
  public metadata?: Record<string, any>;

  constructor(options: {
    id: string;
    name: string;
    user?: { id?: string; sessionId?: string; [key: string]: any };
    attributes?: Record<string, any>;
    tags?: string[];
  }) {
    this.id = options.id;
    this.name = options.name;
    this.startTime = new Date();
    this.user = options.user;
    this.attributes = options.attributes;
    this.tags = options.tags;
  }

  end(status: 'completed' | 'failed' | 'cancelled' = 'completed'): void {
    this.endTime = new Date();
    this.status = status;
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
      case 'trace_started':
        console.log(`[${timestamp}] TRACE_STARTED: ${event.trace.name} (${event.trace.id})`);
        break;
      case 'trace_ended':
        console.log(
          `[${timestamp}] TRACE_ENDED: ${event.trace.name} (${event.trace.id}) - Status: ${event.trace.status}`,
        );
        break;
      case 'span_started':
        console.log(
          `[${timestamp}] SPAN_STARTED: ${event.span.metadata.type} (${event.span.id}) in trace ${event.span.trace.id}`,
        );
        break;
      case 'span_ended':
        const span = event.span as DefaultAISpan;
        const duration = span.endTime && span.startTime ? span.endTime.getTime() - span.startTime.getTime() : 0;
        console.log(`[${timestamp}] SPAN_ENDED: ${span.metadata.type} (${span.id}) - Duration: ${duration}ms`);
        break;
      case 'span_updated':
        console.log(`[${timestamp}] SPAN_UPDATED: ${event.span.metadata.type} (${event.span.id})`);
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

export class DefaultTelemetry extends MastraTelemetry {
  private currentTrace?: Trace;
  private traces = new Map<string, Trace>();

  constructor(config: { name: string } & SharedTelemetryConfig = { name: 'default-telemetry' }) {
    // Add console exporter by default if none provided
    if (!config.exporters || config.exporters.length === 0) {
      config.exporters = [new DefaultConsoleExporter()];
    }

    super(config);
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected _startTrace(
    name: string,
    options?: {
      user?: { id?: string; sessionId?: string; [key: string]: any };
      attributes?: Record<string, any>;
      tags?: string[];
    },
  ): Trace {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const trace = new DefaultTrace({
      id: traceId,
      name,
      user: options?.user,
      attributes: options?.attributes,
      tags: options?.tags,
    });

    this.traces.set(traceId, trace);
    this.currentTrace = trace;

    // Emit trace started event
    this.emitTraceStarted(trace);

    return trace;
  }

  protected _startSpan(options: SpanOptions): AISpan {
    const spanId = `span-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Use current trace if no parent span provided, or parent's trace if parent exists
    const trace = options.parent?.trace || this.currentTrace;

    if (!trace) {
      throw new Error('No active trace found. Start a trace before creating spans.');
    }

    const metadata: SpanMetadata = {
      ...options.metadata,
      traceId: trace.id,
      parentSpanId: options.parent?.id,
      createdAt: new Date(),
    } as SpanMetadata;

    // Use the createSpanWithCallbacks helper to wire up lifecycle callbacks
    return this.createSpanWithCallbacks(options, opts => {
      return new DefaultAISpan({
        id: spanId,
        metadata,
        trace,
        parent: options.parent,
      });
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
            attributes: {
              ...attributes,
              'method.name': prop.toString(),
              'class.name': target.constructor.name,
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
      attributes?: Record<string, any>;
    },
  ): TMethod {
    const { spanName, spanType = SpanType.GENERIC, attributes = {} } = options;

    return ((...args: unknown[]) => {
      // Create span using strongly-typed API
      const span = this.startSpan({
        name: spanName,
        spanType: spanType,
        metadata: {
          attributes,
        } as any, // Type assertion needed for generic span type
        attributes,
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
              span.update({
                error: {
                  message: error.message,
                  code: error.code,
                  stack: error.stack,
                },
              });
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
        span.update({
          error: {
            message: error.message,
            code: error.code,
            stack: error.stack,
          },
        });
        span.end();
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
   * Get the current active trace
   */
  getCurrentTrace(): Trace | undefined {
    return this.currentTrace;
  }

  /**
   * Get all traces
   */
  getAllTraces(): Trace[] {
    return Array.from(this.traces.values());
  }

  /**
   * End the current trace
   */
  endCurrentTrace(status: 'completed' | 'failed' | 'cancelled' = 'completed'): void {
    if (this.currentTrace) {
      (this.currentTrace as DefaultTrace).end(status);
      this.emitTraceEnded(this.currentTrace);
      this.currentTrace = undefined;
    }
  }

  /**
   * Clear all traces (useful for testing)
   */
  clearTraces(): void {
    this.traces.clear();
    this.currentTrace = undefined;
  }
}
