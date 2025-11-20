import { Mastra } from '@mastra/core';
import { Observability, SensitiveDataFilter } from '@mastra/observability';
import { httpInstrumentationMiddleware } from '@hono/otel';
import { testAgent } from './agent';
import { OtelBridge } from '@mastra/otel-bridge';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { swaggerUI } from '@hono/swagger-ui';
import { HonoServerAdapter } from '@mastra/hono';

export const mastra: Mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'tracing-exp',
        spanOutputProcessors: [new SensitiveDataFilter()],
        bridge: new OtelBridge(),
      },
    },
  }),
  agents: { 'test-agent': testAgent },
});

const app = new Hono();

// Add OTEL instrumentation middleware first to capture all requests
app.use('*', httpInstrumentationMiddleware());
app.use('*', cors());

// Register Mastra routes via the HonoServerAdapter
const honoServerAdapter = new HonoServerAdapter({ mastra });
honoServerAdapter.registerContextMiddleware(app);
await honoServerAdapter.registerRoutes(app, { openapiPath: '/openapi.json' });

// Custom routes
app.get('/healthz', async c => {
  return c.json({ status: 'ok', service: 'service-mastra' });
});

app.get('/service-mastra', async c => {
  const agent = mastra.getAgent('test-agent');
  const response = await agent.generate('Hello, how are you?');
  const message = 'service-mastra response: "' + response.text + '"';
  return c.json({ message: message, traceId: response.traceId });
});

// Add Swagger UI
app.use('/swagger-ui/*', swaggerUI({ url: '/openapi.json' }));

const port = 3002;

serve(
  {
    fetch: app.fetch,
    port,
  },
  () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${port}`);
    // eslint-disable-next-line no-console
    console.log(`OpenAPI spec: http://localhost:${port}/openapi.json`);
    // eslint-disable-next-line no-console
    console.log(`Swagger UI: http://localhost:${port}/swagger-ui`);
  },
);

const gracefulShutdown = async () => {
  await mastra.shutdown();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
