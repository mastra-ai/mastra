/**
 * Default Implementation for MastraAITelemetry
 */

import { MastraError } from '../error';
import type { IMastraLogger } from '../logger';
import { ConsoleLogger } from '../logger';
import { MastraAITelemetry } from './base';
import type {
  AISpanType,
  AISpan,
  AISpanOptions,
  AITelemetryExporter,
  AITelemetryConfig,
  AITelemetryEvent,
  AISpanTypeMap,
} from './types';

// ============================================================================
// Default AISpan Implementation
// ============================================================================

function generateId(): string {
  return `span-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

class DefaultAISpan<TType extends AISpanType> implements AISpan<TType> {
  public id: string;
  public name: string;
  public type: TType;
  public metadata: AISpanTypeMap[TType];
  public trace: AISpan<any>;
  public startTime: Date;
  public endTime?: Date;
  public aiTelemetry: MastraAITelemetry;

  constructor(options: AISpanOptions<TType>, aiTelemetry: MastraAITelemetry) {
    this.id = generateId();
    this.name = options.name;
    this.type = options.type;
    this.metadata = options.metadata;
    this.trace = options.parent ? options.parent.trace : (this as any);
    this.startTime = new Date();
    this.aiTelemetry = aiTelemetry;
  }

  end(metadata?: Partial<AISpanTypeMap[TType]>): void {
    this.endTime = new Date();
    if (metadata) {
      this.metadata = { ...this.metadata, ...metadata };
    }
    // Telemetry events automatically handled by base class
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
    return this.aiTelemetry.startSpan(type, name, metadata, this);
  }

  update(metadata: Partial<AISpanTypeMap[TType]>): void {
    this.metadata = { ...this.metadata, ...metadata };
    // Telemetry events automatically handled by base class
  }

  async export(): Promise<string> {
    return JSON.stringify({
      id: this.id,
      metadata: this.metadata,
      startTime: this.startTime,
      endTime: this.endTime,
      traceId: this.trace.id,
    });
  }
}

// ============================================================================
// Default Console Exporter
// ============================================================================

export class DefaultConsoleExporter implements AITelemetryExporter {
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

  async exportEvent(event: AITelemetryEvent): Promise<void> {
    const span = event.span;

    // Helper to safely stringify metadata with sensitive field filtering
    const formatMetadata = (metadata: any) => {
      try {
        // Create a copy and filter out sensitive fields
        const filtered = { ...metadata };
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey', 'auth'];

        sensitiveFields.forEach(field => {
          if (field in filtered) {
            filtered[field] = '[REDACTED]';
          }
        });

        return JSON.stringify(filtered, null, 2);
      } catch (error) {
        return '[Unable to serialize metadata]';
      }
    };

    // Helper to format duration
    const formatDuration = (startTime: Date, endTime?: Date) => {
      if (!endTime) return 'N/A';
      const duration = endTime.getTime() - startTime.getTime();
      return `${duration}ms`;
    };

    switch (event.type) {
      case 'span_started':
        this.logger.info(`🚀 SPAN_STARTED`);
        this.logger.info(`   Type: ${span.type}`);
        this.logger.info(`   Name: ${span.name}`);
        this.logger.info(`   ID: ${span.id}`);
        this.logger.info(`   Trace ID: ${span.trace.id}`);
        this.logger.info(`   Metadata: ${formatMetadata(span.metadata)}`);
        this.logger.info('─'.repeat(80));
        break;

      case 'span_ended':
        const duration = formatDuration(span.startTime, span.endTime);
        this.logger.info(`✅ SPAN_ENDED`);
        this.logger.info(`   Type: ${span.type}`);
        this.logger.info(`   Name: ${span.name}`);
        this.logger.info(`   ID: ${span.id}`);
        this.logger.info(`   Duration: ${duration}`);
        this.logger.info(`   Trace ID: ${span.trace.id}`);
        this.logger.info(`   Final Metadata: ${formatMetadata(span.metadata)}`);
        this.logger.info('─'.repeat(80));
        break;

      case 'span_updated':
        this.logger.info(`📝 SPAN_UPDATED`);
        this.logger.info(`   Type: ${span.type}`);
        this.logger.info(`   Name: ${span.name}`);
        this.logger.info(`   ID: ${span.id}`);
        this.logger.info(`   Trace ID: ${span.trace.id}`);
        this.logger.info(`   Updated Metadata: ${formatMetadata(span.metadata)}`);
        this.logger.info('─'.repeat(80));
        break;

      default:
        this.logger.warn(`❓ UNKNOWN_EVENT: ${JSON.stringify(event)}`);
        this.logger.info('─'.repeat(80));
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('DefaultConsoleExporter shutdown');
  }
}

// ============================================================================
// Default AI Telemetry Implementation
// ============================================================================

export class DefaultAITelemetry extends MastraAITelemetry {
  constructor(config: { name: string } & AITelemetryConfig = { name: 'default-telemetry' }) {
    super(config);

    // Add console exporter by default if none provided, passing this telemetry's logger
    if (!config.exporters || config.exporters.length === 0) {
      this.exporters = [new DefaultConsoleExporter(this.getLogger())];
    }
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected createSpan<TType extends AISpanType>(options: AISpanOptions<TType>): AISpan<TType> {
    // Simple span creation - base class handles all telemetry lifecycle automatically
    return new DefaultAISpan<TType>(options, this);
  }
}
