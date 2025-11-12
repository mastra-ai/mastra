/**
 * OpenTelemetry instrumentation setup for Hono
 *
 * This file sets up standard OTEL auto-instrumentation for the Hono application.
 * It must be imported BEFORE any other application code to properly instrument modules.
 */

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

// Note: @hono/otel is middleware (added in server.ts), not an instrumentation
// For basic context propagation, auto-instrumentations is sufficient

// Use InMemorySpanExporter in test mode for span inspection
const isTest = process.env.NODE_ENV === 'test';
const memoryExporter = isTest ? new InMemorySpanExporter() : undefined;
const traceExporter = isTest
  ? memoryExporter
  : new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    });

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'otel-bridge-example-hono',
  }),
  traceExporter,
  instrumentations: [
    // Auto-instrumentations includes HTTP and many others
    // This automatically sets up AsyncLocalStorage for context propagation
    getNodeAutoInstrumentations({
      // Optional: Configure HTTP instrumentation
      '@opentelemetry/instrumentation-http': {
        // headersToSpanAttributes: {
        //   server: {
        //     requestHeaders: ['x-request-id'],
        //   },
        // },
      },
    }),

    // Optional: Add @hono/otel middleware in server.ts for Hono-specific spans
    // (it's middleware, not an instrumentation, so it goes in the app code)
  ],
});

// Export memory exporter for tests
export { memoryExporter };

// Start the SDK
sdk.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    await sdk.shutdown();
    console.info('OpenTelemetry SDK shut down successfully');
  } catch (error) {
    console.error('Error shutting down OpenTelemetry SDK', error);
  } finally {
    process.exit(0);
  }
});
