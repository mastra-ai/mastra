import type { InitExporterOptions, TracingEvent } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import {
  DeepEvalExporter as DeepEvalCoreExporter,
  type DeepEvalExporterConfig as DeepEvalCoreConfig,
} from 'deepeval/integrations/mastra';

export interface DeepEvalExporterConfig extends BaseExporterConfig, DeepEvalCoreConfig {}

export class DeepEvalExporter extends BaseExporter {
  name = 'deepeval';

  readonly #inner: DeepEvalCoreExporter;

  constructor(config: DeepEvalExporterConfig = {}) {
    super(config);
    this.#inner = new DeepEvalCoreExporter(config);
  }

  override init(options: InitExporterOptions): void {
    this.#inner.init?.(options);
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    await this.#inner.exportTracingEvent(event);
  }

  override async flush(): Promise<void> {
    await this.#inner.flush();
  }

  override async shutdown(): Promise<void> {
    await this.#inner.shutdown();
  }
}
