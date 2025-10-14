import type { TracingConfig } from '@mastra/core/ai-tracing';
import { OtelExporter } from '@mastra/otel-exporter';
import { ArizeSpanConverter } from './span-converter';

export type ArizeExporterConfig = TracingConfig & {
  spaceId?: string;
  spaceKey?: string;
  apiKey?: string;
  endpoint: string;
};

export class ArizeExporter extends OtelExporter {
  name = 'arize';

  constructor(config: ArizeExporterConfig) {
    super({
      ...config,
      spanConverters: [new ArizeSpanConverter()],
    });
  }
}
