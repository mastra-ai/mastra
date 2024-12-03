import { trace, Tracer } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

export type OtelConfig = {
  serviceName?: string;
  enabled?: boolean;
  export?:
    | {
        type: 'otlp';
        endpoint?: string;
        headers?: Record<string, string>;
      }
    | {
        type: 'console';
      };
};

export class Telemetry {
  private static instance: Telemetry;
  private sdk: NodeSDK;
  public tracer: Tracer;

  private constructor(config: OtelConfig) {
    const exporter =
      config.export?.type === 'otlp'
        ? new OTLPTraceExporter({
            url: config.export.endpoint,
            headers: config.export.headers,
          })
        : new ConsoleSpanExporter();

    this.sdk = new NodeSDK({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: config.serviceName ?? 'default-service',
      }),
      traceExporter: exporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
        }),
      ],
    });

    this.sdk.start();
    this.tracer = trace.getTracer('my-library');

    process.on('SIGTERM', () => {
      this.sdk
        .shutdown()
        .catch(console.error)
        .finally(() => process.exit(0));
    });
  }

  static init(config: OtelConfig = {}): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry(config);
    }
    return Telemetry.instance;
  }

  static get(): Telemetry {
    if (!Telemetry.instance) {
      throw new Error('Telemetry not initialized');
    }
    return Telemetry.instance;
  }
}
