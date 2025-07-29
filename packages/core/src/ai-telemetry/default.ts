/**
 * Default Implementation for MastraAITelemetry
 */

import { MastraError } from '../error';
import { MastraAITelemetry } from './base';
import {
  type AISpan,
  type AISpanOptions,
  type AISpanMetadata,
  AISpanType,
  type AITelemetryExporter,
  type AITelemetryConfig,
  type AIBaseMetadata,
} from './types';

// ============================================================================
// Default AISpan Implementation
// ============================================================================

function generateId(): string {
  return `span-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

class DefaultAISpan implements AISpan<AIBaseMetadata> {
  public id: string;
  public name: string;
  public type: AISpanType;
  public metadata: AISpanMetadata;
  public children: AISpan<AISpanMetadata>[] = [];
  public parent?: AISpan<AISpanMetadata>;
  public trace: AISpan<AISpanMetadata>;
  public startTime: Date;
  public endTime?: Date;
  public aiTelemetry: MastraAITelemetry;

  constructor(options: AISpanOptions, aiTelemetry: MastraAITelemetry) {
    this.id = generateId();
    this.name = options.name;
    this.type = options.type;
    this.metadata = options.metadata;
    this.parent = options.parent;
    this.trace = options.parent ? options.parent.trace : this;
    this.startTime = new Date();
    this.aiTelemetry = aiTelemetry;

    // Add to parent's children if we have a parent
    if (this.parent) {
      this.parent.children.push(this);
    }
  }

  end(metadata?: Partial<AIBaseMetadata>): void {
    this.endTime = new Date();
    if (metadata) {
      this.metadata = { ...this.metadata, ...metadata };
    }
    // Callback will be set up by base class createSpanWithCallbacks
  }

  // TODO: could endSpan be default = true?
  error(error: MastraError | Error, endSpan: boolean): void {
    const metadata =
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
      this.end(metadata);
    } else {
      this.update(metadata);
    }
  }

  createChildSpan(options: AISpanOptions): AISpan {
    options.parent = this;
    return this.aiTelemetry.startSpan(options);
  }

  update(metadata: AIBaseMetadata): void {
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

export class DefaultConsoleExporter implements AITelemetryExporter {
  name = 'default-console';

  async exportEvent(event: import('./types').AITelemetryEvent): Promise<void> {
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
// Default AI Telemetry Implementation
// ============================================================================

export class DefaultAITelemetry extends MastraAITelemetry {
  private traces = new Map<string, AISpan>();

  constructor(config: { name: string } & AITelemetryConfig = { name: 'default-telemetry' }) {
    // Add console exporter by default if none provided
    if (!config.exporters || config.exporters.length === 0) {
      config.exporters = [new DefaultConsoleExporter()];
    }

    super(config);
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected _startSpan(options: AISpanOptions): AISpan {
    // Use the createSpanWithCallbacks helper to wire up lifecycle callbacks
    return this.createSpanWithCallbacks(options, () => {
      return new DefaultAISpan(options, this);
    });
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
