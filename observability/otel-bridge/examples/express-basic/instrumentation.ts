/**
 * OpenTelemetry instrumentation setup
 *
 * This file sets up standard OTEL auto-instrumentation for the Express application.
 * It must be imported BEFORE any other application code to properly instrument modules.
 */

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

// Optional: Add Express-specific instrumentation for enhanced spans
// Provides better route-level granularity and middleware tracking
// import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

// Use InMemorySpanExporter in test mode for span inspection
const isTest = process.env.NODE_ENV === 'test';
const memoryExporter = isTest ? new InMemorySpanExporter() : undefined;

// For testing, use SimpleSpanProcessor for immediate span export
// For production, NodeSDK will use BatchSpanProcessor by default
const sdk =
  isTest && memoryExporter
    ? new NodeSDK({
        resource: defaultResource().merge(
          resourceFromAttributes({
            [ATTR_SERVICE_NAME]: 'otel-bridge-example-express',
          }),
        ),
        spanProcessors: [new SimpleSpanProcessor(memoryExporter)],
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': {},
          }),
        ],
      })
    : new NodeSDK({
        resource: defaultResource().merge(
          resourceFromAttributes({
            [ATTR_SERVICE_NAME]: 'otel-bridge-example-express',
          }),
        ),
        traceExporter: new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
        }),
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': {},
          }),
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
