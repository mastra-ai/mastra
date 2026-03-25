import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { OtelExporter } from '@mastra/otel-exporter';
import { elasticsearchAgent } from './agents/elasticsearch-agent';

const exporters = [
  new DefaultExporter(), // For local Mastra Playground UI
  new CloudExporter(), // For Mastra Cloud (optional)
];

if (process.env.ELASTIC_APM_ENDPOINT) {
  const endpoint = process.env.ELASTIC_APM_ENDPOINT.endsWith('/v1/traces')
    ? process.env.ELASTIC_APM_ENDPOINT
    : `${process.env.ELASTIC_APM_ENDPOINT}/v1/traces`;

  console.log(`[Observability] Elastic APM enabled: ${endpoint}`);

  exporters.push(
    new OtelExporter({
      provider: {
        custom: {
          endpoint,
          protocol: 'http/protobuf',
          headers: process.env.ELASTIC_APM_SECRET_TOKEN
            ? { Authorization: `ApiKey ${process.env.ELASTIC_APM_SECRET_TOKEN}` }
            : {},
        },
      },
    })
  );
} else {
  console.log('[Observability] Elastic APM not configured. Set ELASTIC_APM_ENDPOINT to enable.');
}

export const mastra = new Mastra({
  agents: { elasticsearchAgent },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'chat-with-elasticsearch',
        exporters,
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
