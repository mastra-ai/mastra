import { Mastra } from '@mastra/core';
import { Observability, SamplingStrategyType, SensitiveDataFilter } from '@mastra/observability';
import { httpInstrumentationMiddleware } from '@hono/otel';
import { mastraEndpoint, testAgent } from './endpoint.js';
import { OtelBridge } from '@mastra/otel-bridge';

const PROJECT_NAME = process.env.ARIZE_PROJECT_NAME || 'tracing-exp';

export const mastra: Mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: PROJECT_NAME,
        sampling: { type: SamplingStrategyType.ALWAYS },
        spanOutputProcessors: [new SensitiveDataFilter()],
        bridge: new OtelBridge(),
      },
    },
  }),
  agents: { 'test-agent': testAgent },
  server: {
    port: 4111,
    apiRoutes: [mastraEndpoint],
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
    middleware: { path: '*', handler: httpInstrumentationMiddleware() },
  },
});
