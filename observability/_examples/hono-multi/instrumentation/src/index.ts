/**
 * Shared OpenTelemetry instrumentation for hono-multi example services
 *
 * Configures OTEL to export traces to Arize Phoenix running locally.
 */

import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

// Enable diagnostic logging for debugging
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

let sdk: NodeSDK | null = null;

/**
 * Initialize and start OpenTelemetry instrumentation
 *
 * Exports traces to Arize Phoenix at http://localhost:6006
 */
export function startTelemetry(serviceName: string): void {
  if (sdk) {
    console.warn('[Telemetry] SDK already initialized');
    return;
  }

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      // Arize Phoenix gRPC OTLP endpoint
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy instrumentations
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();
  console.log(`[Telemetry] Started for service: ${serviceName}`);
}

/**
 * Gracefully shutdown OpenTelemetry instrumentation
 */
export async function stopTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
    console.log('[Telemetry] Shutdown complete');
    sdk = null;
  } catch (error) {
    console.error('[Telemetry] Error during shutdown:', error);
  }
}
