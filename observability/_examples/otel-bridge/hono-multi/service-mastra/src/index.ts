import { Mastra } from '@mastra/core';
import { Observability, SensitiveDataFilter } from '@mastra/observability';
import { httpInstrumentationMiddleware } from '@hono/otel';
import { testAgent } from './agent';
import { OtelBridge } from '@mastra/otel-bridge';
import { stopTelemetry } from '@mastra/hono-multi-instrumentation';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { swaggerUI } from '@hono/swagger-ui';
import { MastraServer } from '@mastra/hono';

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
const honoServerAdapter = new MastraServer({ app, mastra, openapiPath: '/openapi.json' });
honoServerAdapter.registerContextMiddleware();
await honoServerAdapter.registerRoutes();

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

const server = serve(
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

const gracefulShutdown = async (signal: string) => {
  console.log(`[service-mastra] Received ${signal}, shutting down gracefully...`);

  await new Promise<void>((resolve, reject) => {
    server.close(err => {
      if (err) {
        console.error('[service-mastra] Error closing server:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });

  await stopTelemetry();
  console.log('[service-mastra] Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
