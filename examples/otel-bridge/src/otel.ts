import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

// Set default service name via environment variable if not already set
if (!process.env.OTEL_SERVICE_NAME) {
  process.env.OTEL_SERVICE_NAME = 'story-api';
}

// Initialize OTEL with auto-instrumentation
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // HTTP instrumentation is required for proper span naming with Fastify
      '@opentelemetry/instrumentation-http': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-fastify': {
        enabled: true,
        requestHook: (span, info) => {
          // Get the route pattern (e.g., "/api/stories/:id") from Fastify routeOptions
          // This is the route definition, not the actual URL being requested
          const route = info.request.routeOptions?.url;
          console.log("ROUTE", route)

          // Set http.route attribute - the HTTP instrumentation uses this
          // to rename the span to "${method} ${route}" format
          if (route) {
            span.setAttribute('http.route', route);
            console.log("SPAN", span)
          }
        },
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
      },
      // Disable DNS tracing to reduce noise in Jaeger
      '@opentelemetry/instrumentation-dns': {
        enabled: false,
      },
      // Disable TCP tracing to reduce noise in Jaeger
      '@opentelemetry/instrumentation-net': {
        enabled: false,
      },
    }),
  ],
});

sdk.start();

console.log('✓ OpenTelemetry initialized');
console.log(`  Service: ${process.env.OTEL_SERVICE_NAME}`);
console.log(`  Exporting to: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'}`);

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('OpenTelemetry terminated'))
    .catch((err: any) => console.error('OpenTelemetry shutdown error:', err));
});
