/**
 * Next.js instrumentation hook for OpenTelemetry setup
 *
 * This file sets up standard OTEL auto-instrumentation for Next.js in Node.js runtime.
 * It must be at the project root and export a `register()` function.
 *
 * Note: This only works with Node.js runtime, not Edge runtime.
 * For Edge runtime, use middleware-based header extraction instead.
 */

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

// Optional: Use Vercel's OTEL package for enhanced Next.js integration
// import { registerOTel } from '@vercel/otel';

let sdk: NodeSDK | undefined;

export function register() {
  // Only initialize in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs' || !process.env.NEXT_RUNTIME) {
    // Option 1: Use Vercel's @vercel/otel package (recommended for production)
    // Provides better Next.js integration and is used by Vercel
    // Uncomment to use:
    // registerOTel({
    //   serviceName: 'otel-bridge-example-nextjs-basic',
    // });

    // Option 2: Use standard OTEL SDK (shown here for clarity)
    sdk = new NodeSDK({
      resource: defaultResource().merge(
        resourceFromAttributes({
          [ATTR_SERVICE_NAME]: 'otel-bridge-example-nextjs-basic',
        }),
      ),
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      }),
      instrumentations: [
        // Auto-instrumentations includes HTTP and many others
        // This automatically sets up AsyncLocalStorage for context propagation
        getNodeAutoInstrumentations({
          // Optional: Configure specific instrumentations
          '@opentelemetry/instrumentation-http': {
            // headersToSpanAttributes: {
            //   server: {
            //     requestHeaders: ['x-request-id'],
            //   },
            // },
          },
        }),
      ],
    });

    sdk.start();
    console.info('OpenTelemetry SDK initialized for Next.js');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      try {
        await sdk?.shutdown();
        console.info('OpenTelemetry SDK shut down successfully');
      } catch (error) {
        console.error('Error shutting down OpenTelemetry SDK', error);
      } finally {
        process.exit(0);
      }
    });
  }
}
