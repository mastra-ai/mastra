/**
 * OpenTelemetry instrumentation setup with Mastra OtelBridge integration
 *
 * This file sets up standard OTEL auto-instrumentation for the Fastify application.
 * The OtelBridge automatically reads from OTEL's ambient context (via AsyncLocalStorage)
 * and exports Mastra spans back to OTEL.
 *
 * It must be imported BEFORE any other application code to properly instrument modules.
 */

import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {defaultResource, resourceFromAttributes} from '@opentelemetry/resources';
import {NodeSDK} from '@opentelemetry/sdk-node';
import {ATTR_SERVICE_NAME} from '@opentelemetry/semantic-conventions';
import {HostMetrics} from '@opentelemetry/host-metrics';
import FastifyOtelInstrumentation from '@fastify/otel';

type IgnoreFunction = (request: {url?: string}) => boolean;

/**
 * Hook function for @opentelemetry/instrumentation-http to ignore incoming requests for ping and health endpoints
 * to avoid unnecessary tracing.
 */
export const isIgnorableRequest: IgnoreFunction = request =>
  request.url === '/ping' || request.url === '/health' || request.url === '/metrics' || request.url === '/favicon.ico';

// Initialize NodeSDK with auto-instrumentations
const sdk = new NodeSDK({
  resource: defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'agent-hub',
    }),
  ),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    ...getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        headersToSpanAttributes: {
          server: {
            requestHeaders: ['x-request-id'],
          },
        },
        ignoreIncomingRequestHook: isIgnorableRequest,
      },
    }),
    new FastifyOtelInstrumentation({registerOnInitialization: true}),
  ],
});

// Start the SDK
sdk.start();

// Initialize host metrics
const hostMetrics = new HostMetrics();
hostMetrics.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    await sdk.shutdown();
    console.info('OpenTelemetry SDK shut down successfully');
  } catch (error) {
    console.error('Error shutting down OpenTelemetry SDK', error);
  } finally {
    process.exit(1);
  }
});
