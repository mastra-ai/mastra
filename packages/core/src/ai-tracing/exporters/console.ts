import { ConsoleLogger, LogLevel } from '../../logger';
import type { IMastraLogger } from '../../logger';
import { AITracingEventType } from '../types';
import type { AITracingEvent, AITracingExporter } from '../types';

export class ConsoleExporter implements AITracingExporter {
  name = 'tracing-console-exporter';
  private logger: IMastraLogger;

  constructor(logger?: IMastraLogger) {
    if (logger) {
      this.logger = logger;
    } else {
      // Fallback: create a direct ConsoleLogger instance if none provided
      this.logger = new ConsoleLogger({ level: LogLevel.INFO });
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
        this.logger.warn(`Tracing event type not implemented: ${(event as any).type}`);
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('ConsoleExporter shutdown');
  }
}
