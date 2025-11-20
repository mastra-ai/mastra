import type { TracingEvent } from '@mastra/core/observability';
import { BaseExporter } from './base';
import type { BaseExporterConfig } from './base';

export class TestExporter extends BaseExporter {
  name = 'tracing-test-exporter';
  #events: TracingEvent[] = [];

  constructor(config: BaseExporterConfig = {}) {
    super(config);
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    this.#events.push(event);
  }

  clearEvents() {
    this.#events = [];
  }

  get events(): TracingEvent[] {
    return this.#events;
  }

  async shutdown(): Promise<void> {
    this.logger.info('TestExporter shutdown');
  }
}
