/**
 * Default Implementation for MastraAITracing
 */

import { MastraError } from '../error';
import type { IMastraLogger } from '../logger';
import { ConsoleLogger, LogLevel } from '../logger';
import { MastraAITracing } from './base';
import type {
  AISpanType,
  AISpan,
  AISpanOptions,
  AITracingExporter,
  AITracingInstanceConfig,
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
  public attributes: AISpanTypeMap[TType];
  public parent?: AnyAISpan;
  public trace: AnyAISpan;
  public traceId: string;
  public startTime: Date;
  public endTime?: Date;
  public aiTracing: MastraAITracing;
  public input?: any;
  public output?: any;
  public errorInfo?: {
    message: string;
    id?: string;
    domain?: string;
    category?: string;
    details?: Record<string, any>;
  };
  public metadata?: Record<string, any>;

  constructor(options: AISpanOptions<TType>, aiTracing: MastraAITracing) {
    this.id = generateSpanId();
    this.name = options.name;
    this.type = options.type;
    this.attributes = options.attributes || ({} as AISpanTypeMap[TType]);
    this.metadata = options.metadata;
    this.parent = options.parent;
    this.trace = options.parent ? options.parent.trace : (this as any);
    this.startTime = new Date();
    this.aiTracing = aiTracing;
    this.input = options.input;

    // Set trace ID: generate new for root spans, inherit for child spans
    if (!options.parent) {
      // This is a root span, so it becomes its own trace with a new trace ID
      this.traceId = generateTraceId();
    } else {
      // Child span inherits trace ID from root span
      this.traceId = options.parent.trace.traceId;
    }
  }

  end(options?: { output?: any; attributes?: Partial<AISpanTypeMap[TType]>; metadata?: Record<string, any> }): void {
    this.endTime = new Date();
    if (options?.output !== undefined) {
      this.output = options.output;
    }
    if (options?.attributes) {
      this.attributes = { ...this.attributes, ...options.attributes };
    }
    if (options?.metadata) {
      this.metadata = { ...this.metadata, ...options.metadata };
    }
    // Tracing events automatically handled by base class
  }

  error(options: {
    error: MastraError | Error;
    endSpan?: boolean;
    attributes?: Partial<AISpanTypeMap[TType]>;
    metadata?: Record<string, any>;
  }): void {
    const { error, endSpan = true, attributes, metadata } = options;

    this.errorInfo =
      error instanceof MastraError
        ? {
            id: error.id,
            details: error.details,
            category: error.category,
            domain: error.domain,
            message: error.message,
          }
        : {
            message: error.message,
          };

    // Update attributes if provided
    if (attributes) {
      this.attributes = { ...this.attributes, ...attributes };
    }
    if (metadata) {
      this.metadata = { ...this.metadata, ...metadata };
    }

    if (endSpan) {
      this.end();
    } else {
      // Trigger span update event when not ending the span
      this.update({});
    }
    // Note: errorInfo is now a span property, attributes handled above
  }

  createChildSpan<TChildType extends AISpanType>(options: {
    type: TChildType;
    name: string;
    input?: any;
    attributes?: AISpanTypeMap[TChildType];
    metadata?: Record<string, any>;
  }): AISpan<TChildType> {
    return this.aiTracing.startSpan({
      ...options,
      parent: this,
    });
  }

  update(options?: {
    input?: any;
    output?: any;
    attributes?: Partial<AISpanTypeMap[TType]>;
    metadata?: Record<string, any>;
  }): void {
    if (options?.input !== undefined) {
      this.input = options.input;
    }
    if (options?.output !== undefined) {
      this.output = options.output;
    }
    if (options?.attributes) {
      this.attributes = { ...this.attributes, ...options.attributes };
    }
    if (options?.metadata) {
      this.metadata = { ...this.metadata, ...options.metadata };
    }
    // Tracing events automatically handled by base class
  }

  get isRootSpan(): boolean {
    return !this.parent;
  }

  async export(): Promise<string> {
    return JSON.stringify({
      id: this.id,
      attributes: this.attributes,
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
      // Create a copy of the span with filtered attributes
      const filteredSpan = { ...span };
      filteredSpan.attributes = deepFilter(span.attributes);
      filteredSpan.metadata = deepFilter(span.metadata);
      filteredSpan.input = deepFilter(span.input);
      filteredSpan.output = deepFilter(span.output);
      filteredSpan.errorInfo = deepFilter(span.errorInfo);
      return filteredSpan;
    } catch (error) {
      // If filtering fails, return heavily redacted span for security
      const safeSpan = { ...span };
      safeSpan.attributes = {
        '[FILTERING_ERROR]': 'Attributes were completely redacted due to filtering error',
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
        level: LogLevel.INFO, // Set to INFO so that info() calls actually log
      });
    }
  }

  async exportEvent(event: AITracingEvent): Promise<void> {
    const span = event.span;

    // Helper to safely stringify attributes (filtering already done by processor)
    const formatAttributes = (attributes: any) => {
      try {
        return JSON.stringify(attributes, null, 2);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown formatting error';
        return `[Unable to serialize attributes: ${errMsg}]`;
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
        if (span.input !== undefined) {
          this.logger.info(`   Input: ${formatAttributes(span.input)}`);
        }
        this.logger.info(`   Attributes: ${formatAttributes(span.attributes)}`);
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
        if (span.input !== undefined) {
          this.logger.info(`   Input: ${formatAttributes(span.input)}`);
        }
        if (span.output !== undefined) {
          this.logger.info(`   Output: ${formatAttributes(span.output)}`);
        }
        if (span.errorInfo) {
          this.logger.info(`   Error: ${formatAttributes(span.errorInfo)}`);
        }
        this.logger.info(`   Attributes: ${formatAttributes(span.attributes)}`);
        this.logger.info('─'.repeat(80));
        break;

      case AITracingEventType.SPAN_UPDATED:
        this.logger.info(`📝 SPAN_UPDATED`);
        this.logger.info(`   Type: ${span.type}`);
        this.logger.info(`   Name: ${span.name}`);
        this.logger.info(`   ID: ${span.id}`);
        this.logger.info(`   Trace ID: ${span.traceId}`);
        if (span.input !== undefined) {
          this.logger.info(`   Input: ${formatAttributes(span.input)}`);
        }
        if (span.output !== undefined) {
          this.logger.info(`   Output: ${formatAttributes(span.output)}`);
        }
        if (span.errorInfo) {
          this.logger.info(`   Error: ${formatAttributes(span.errorInfo)}`);
        }
        this.logger.info(`   Updated Attributes: ${formatAttributes(span.attributes)}`);
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

export const aiTracingDefaultConfig: AITracingInstanceConfig = {
  serviceName: 'mastra-ai-service',
  instanceName: 'default',
  sampling: { type: SamplingStrategyType.ALWAYS },
  exporters: [new DefaultConsoleExporter()], // Uses its own fallback logger
  processors: [new SensitiveDataFilter()],
};

// ============================================================================
// Default AI Tracing Implementation
// ============================================================================

export class DefaultAITracing extends MastraAITracing {
  constructor(config: AITracingInstanceConfig = aiTracingDefaultConfig) {
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
