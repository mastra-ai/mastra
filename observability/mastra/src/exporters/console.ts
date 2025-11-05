import { TracingEventType } from '@mastra/core/observability';
import type { TracingEvent } from '@mastra/core/observability';
import { BaseExporter } from './base';
import type { BaseExporterConfig } from './base';

export class ConsoleExporter extends BaseExporter {
  name = 'tracing-console-exporter';

  constructor(config: BaseExporterConfig = {}) {
    super(config);
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    const span = event.exportedSpan;

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
      case TracingEventType.SPAN_STARTED:
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

      case TracingEventType.SPAN_ENDED:
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

      case TracingEventType.SPAN_UPDATED:
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
