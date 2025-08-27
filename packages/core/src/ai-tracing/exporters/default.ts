import { ConsoleLogger, LogLevel } from '../../logger';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { AISpanRecord } from '../../storage/types';
import { AITracingEventType } from '../types';
import type { AITracingEvent, AITracingExporter, AnyAISpan } from '../types';

type InternalAISpanRecord = Omit<AISpanRecord, 'spanId' | 'traceId' | 'createdAt' | 'updatedAt'>;

export class DefaultExporter implements AITracingExporter {
  name = 'tracing-default-exporter';
  private logger: IMastraLogger;
  private mastra: Mastra;

  constructor(mastra: Mastra, logger?: IMastraLogger) {
    if (logger) {
      this.logger = logger;
    } else {
      // Fallback: create a direct ConsoleLogger instance if none provided
      this.logger = new ConsoleLogger({ level: LogLevel.INFO });
    }
    this.mastra = mastra;
  }

  /**
   * Serializes span attributes to storage record format
   * Handles all AI span types and their specific attributes
   */
  private serializeAttributes(span: AnyAISpan): Record<string, any> | null {
    if (!span.attributes) {
      return null;
    }

    try {
      // Convert the typed attributes to a plain object
      // This handles nested objects, dates, and other complex types
      return JSON.parse(
        JSON.stringify(span.attributes, (_key, value) => {
          // Handle Date objects
          if (value instanceof Date) {
            return value.toISOString();
          }
          // Handle other objects that might not serialize properly
          if (typeof value === 'object' && value !== null) {
            // For arrays and plain objects, let JSON.stringify handle them
            return value;
          }
          // For primitives, return as-is
          return value;
        }),
      );
    } catch (error) {
      this.logger.warn('Failed to serialize span attributes, storing as null', {
        spanId: span.id,
        spanType: span.type,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private buildCreateRecord(span: AnyAISpan): InternalAISpanRecord {
    return {
      parentSpanId: span.parent?.id ?? null,
      name: span.name,
      scope: null,
      spanType: span.type,
      attributes: this.serializeAttributes(span),
      metadata: span.metadata ?? null,
      links: null,
      startedAt: span.startTime,
      endedAt: span.endTime ?? null,
      input: span.input,
      output: span.output,
      error: span.errorInfo,
      isEvent: span.isEvent,
    };
  }

  private buildUpdateRecord(span: AnyAISpan): Partial<InternalAISpanRecord> {
    return {
      name: span.name,
      scope: null,
      attributes: this.serializeAttributes(span),
      metadata: span.metadata ?? null,
      links: null,
      endedAt: span.endTime ?? null,
      input: span.input,
      output: span.output,
      error: span.errorInfo,
    };
  }

  async exportEvent(event: AITracingEvent): Promise<void> {
    const storage = this.mastra.getStorage();

    if (!storage) {
      this.logger.warn('Cannot store traces. Mastra storage is not initialized');
      return;
    }

    const span = event.span;

    // Event spans only have an end event
    if (span.isEvent) {
      if (event.type == AITracingEventType.SPAN_ENDED) {
        await storage.createAISpan({
          traceId: span.traceId,
          spanId: span.id,
          ...this.buildCreateRecord(span),
          // are these handled by the DB?
          createdAt: new Date(),
          updatedAt: null,
        });
      } else {
        this.logger.warn(`Tracing event type not implemented for event spans: ${(event as any).type}`);
      }
    } else {
      switch (event.type) {
        case AITracingEventType.SPAN_STARTED:
          await storage.createAISpan({
            traceId: span.traceId,
            spanId: span.id,
            ...this.buildCreateRecord(span),
            // are these handled by the DB?
            createdAt: new Date(),
            updatedAt: null,
          });
          break;
        case AITracingEventType.SPAN_UPDATED:
        case AITracingEventType.SPAN_ENDED:
          await storage.updateAISpan({
            traceId: span.traceId,
            spanId: span.id,
            updates: {
              ...this.buildUpdateRecord(span),
              // is this handled by the DB?
              updatedAt: new Date(),
            },
          });
          break;
        default:
          throw new Error(`Tracing event type not implemented: ${(event as any).type}`);
      }
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('DefaultExporter shutdown');
  }
}
