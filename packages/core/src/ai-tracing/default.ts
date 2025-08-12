/**
 * Default Implementation for MastraAITracing
 */

import { MastraError } from '../error';
import type { IMastraLogger } from '../logger';
import { ConsoleLogger } from '../logger';
import { MastraAITracing } from './base';
import type {
  AISpanType,
  AISpan,
  AISpanOptions,
  AITracingExporter,
  AITracingConfig,
  AITracingEvent,
  AISpanTypeMap,
  AISpanProcessor,
  AnyAISpan,
} from './types';
import { SamplingStrategyType, AITracingEventType } from './types';

// ============================================================================
// Default AISpan Implementation
// ============================================================================

/**
 * Generate OpenTelemetry-compatible span ID (64-bit, 16 hex chars)
 */
function generateSpanId(): string {
  // Generate 8 random bytes (64 bits) in hex format
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate OpenTelemetry-compatible trace ID (128-bit, 32 hex chars)
 */
function generateTraceId(): string {
  // Generate 16 random bytes (128 bits) in hex format
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

class DefaultAISpan<TType extends AISpanType> implements AISpan<TType> {
  public id: string;
  public name: string;
  public type: TType;
  public metadata: AISpanTypeMap[TType];
  public trace: AISpan<any>;
  public traceId: string;
  public startTime: Date;
  public endTime?: Date;
  public aiTracing: MastraAITracing;

  constructor(options: AISpanOptions<TType>, aiTracing: MastraAITracing) {
    this.id = generateSpanId();
    this.name = options.name;
    this.type = options.type;
    this.metadata = options.metadata;
    this.trace = options.parent ? options.parent.trace : (this as any);
    this.startTime = new Date();
    this.aiTracing = aiTracing;

    // Set trace ID: generate new for root spans, inherit for child spans
    if (!options.parent) {
      // This is a root span, so it becomes its own trace with a new trace ID
      this.traceId = generateTraceId();
    } else {
      // Child span inherits trace ID from root span
      this.traceId = options.parent.trace.traceId;
    }
  }

  end(metadata?: Partial<AISpanTypeMap[TType]>): void {
    this.endTime = new Date();
    if (metadata) {
      this.metadata = { ...this.metadata, ...metadata };
    }
    // Tracing events automatically handled by base class
  }

  error(error: MastraError | Error, endSpan: boolean = true): void {
    const errorMetadata =
      error instanceof MastraError
        ? {
            error: {
              id: error.id,
              details: error.details,
              category: error.category,
              domain: error.domain,
              message: error.message,
            },
          }
        : {
            error: {
              message: error.message,
            },
          };

    if (endSpan) {
      this.end(errorMetadata as Partial<AISpanTypeMap[TType]>);
    } else {
      this.update(errorMetadata as Partial<AISpanTypeMap[TType]>);
    }
  }

  createChildSpan<TChildType extends AISpanType>(
    type: TChildType,
    name: string,
    metadata: AISpanTypeMap[TChildType],
  ): AISpan<TChildType> {
    return this.aiTracing.startSpan(type, name, metadata, this);
  }

  update(metadata: Partial<AISpanTypeMap[TType]>): void {
    this.metadata = { ...this.metadata, ...metadata };
    // Tracing events automatically handled by base class
  }

  async export(): Promise<string> {
    return JSON.stringify({
      id: this.id,
      metadata: this.metadata,
      startTime: this.startTime,
      endTime: this.endTime,
      traceId: this.traceId, // OpenTelemetry trace ID
    });
  }
}

// ============================================================================
// Sensitive Data Filter Processor
// ============================================================================

export class SensitiveDataFilter implements AISpanProcessor {
  name = 'sensitive-data-filter';
  private sensitiveFields: string[];

  constructor(sensitiveFields?: string[]) {
    // Default sensitive fields with case-insensitive matching
    this.sensitiveFields = (
      sensitiveFields || [
        'password',
        'token',
        'secret',
        'key',
        'apiKey',
        'auth',
        'authorization',
        'bearer',
        'jwt',
        'credential',
        'sessionId',
      ]
    ).map(field => field.toLowerCase());
  }

  process(span: AnyAISpan): AnyAISpan | null {
    // Deep filter function to recursively handle nested objects
    const deepFilter = (obj: any, seen = new WeakSet()): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      // Handle circular references
      if (seen.has(obj)) {
        return '[Circular Reference]';
      }
      seen.add(obj);

      if (Array.isArray(obj)) {
        return obj.map(item => deepFilter(item, seen));
      }

      const filtered: any = {};
      Object.keys(obj).forEach(key => {
        if (this.sensitiveFields.includes(key.toLowerCase())) {
          // Only redact primitive values, recurse into objects/arrays
          if (obj[key] && typeof obj[key] === 'object') {
            filtered[key] = deepFilter(obj[key], seen);
          } else {
            filtered[key] = '[REDACTED]';
          }
        } else {
          filtered[key] = deepFilter(obj[key], seen);
        }
      });

      return filtered;
    };

    try {
      // Create a copy of the span with filtered metadata
      const filteredSpan = { ...span };
      filteredSpan.metadata = deepFilter(span.metadata);
      return filteredSpan;
    } catch (error) {
      // If filtering fails, return heavily redacted span for security
      const safeSpan = { ...span };
      safeSpan.metadata = {
        '[FILTERING_ERROR]': 'Metadata was completely redacted due to filtering error',
        '[ERROR_MESSAGE]': error instanceof Error ? error.message : 'Unknown filtering error',
      } as any;
      return safeSpan;
    }
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }
}

// ============================================================================
// Default Console Exporter
// ============================================================================

export class DefaultConsoleExporter implements AITracingExporter {
  name = 'default-console';
  private logger: IMastraLogger;

  constructor(logger?: IMastraLogger) {
    if (logger) {
      this.logger = logger;
    } else {
      // Fallback: create a direct ConsoleLogger instance if none provided
      this.logger = new ConsoleLogger({
        name: 'default-console-exporter',
      });
    }
  }

  async exportEvent(event: AITracingEvent): Promise<void> {
    const span = event.span;

    // Helper to safely stringify metadata (filtering already done by processor)
    const formatMetadata = (metadata: any) => {
      try {
        return JSON.stringify(metadata, null, 2);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown formatting error';
        return `[Unable to serialize metadata: ${errMsg}]`;
      }
    };

    // Helper to format duration
    const formatDuration = (startTime: Date, endTime?: Date) => {
      if (!endTime) return 'N/A';
      const duration = endTime.getTime() - startTime.getTime();
      return `${duration}ms`;
    };

    switch (event.type) {
      case AITracingEventType.SPAN_STARTED:
        this.logger.info(`🚀 SPAN_STARTED`);
        this.logger.info(`   Type: ${span.type}`);
        this.logger.info(`   Name: ${span.name}`);
        this.logger.info(`   ID: ${span.id}`);
        this.logger.info(`   Trace ID: ${span.traceId}`);
        this.logger.info(`   Metadata: ${formatMetadata(span.metadata)}`);
        this.logger.info('─'.repeat(80));
        break;

      case AITracingEventType.SPAN_ENDED:
        const duration = formatDuration(span.startTime, span.endTime);
        this.logger.info(`✅ SPAN_ENDED`);
        this.logger.info(`   Type: ${span.type}`);
        this.logger.info(`   Name: ${span.name}`);
        this.logger.info(`   ID: ${span.id}`);
        this.logger.info(`   Duration: ${duration}`);
        this.logger.info(`   Trace ID: ${span.traceId}`);
        this.logger.info(`   Final Metadata: ${formatMetadata(span.metadata)}`);
        this.logger.info('─'.repeat(80));
        break;

      case AITracingEventType.SPAN_UPDATED:
        this.logger.info(`📝 SPAN_UPDATED`);
        this.logger.info(`   Type: ${span.type}`);
        this.logger.info(`   Name: ${span.name}`);
        this.logger.info(`   ID: ${span.id}`);
        this.logger.info(`   Trace ID: ${span.traceId}`);
        this.logger.info(`   Updated Metadata: ${formatMetadata(span.metadata)}`);
        this.logger.info('─'.repeat(80));
        break;

      default:
        throw new Error(`Tracing event type not implemented: ${(event as any).type}`);
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('DefaultConsoleExporter shutdown');
  }
}

// ============================================================================
// Default Configuration (defined after classes to avoid circular dependencies)
// ============================================================================

export const aiTracingDefaultConfig: AITracingConfig = {
  serviceName: 'mastra-ai-service',
  sampling: { type: SamplingStrategyType.ALWAYS },
  exporters: [new DefaultConsoleExporter()], // Uses its own fallback logger
  processors: [new SensitiveDataFilter()],
};

// ============================================================================
// Default AI Tracing Implementation
// ============================================================================

export class DefaultAITracing extends MastraAITracing {
  constructor(config: AITracingConfig = aiTracingDefaultConfig) {
    super(config);
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected createSpan<TType extends AISpanType>(options: AISpanOptions<TType>): AISpan<TType> {
    // Simple span creation - base class handles all tracing lifecycle automatically
    return new DefaultAISpan<TType>(options, this);
  }
}
