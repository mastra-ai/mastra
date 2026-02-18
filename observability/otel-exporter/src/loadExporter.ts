/**
 * Dynamic loader for optional OtelExporters
 *
 * Supports loading trace, log, and metric exporters based on protocol.
 */

import type { ExportProtocol } from './types.js';

export type SignalType = 'traces' | 'logs' | 'metrics';

// Dynamic imports for optional dependencies - traces
let OTLPHttpTraceExporter: any;
let OTLPGrpcTraceExporter: any;
let OTLPProtoTraceExporter: any;
let ZipkinExporter: any;

// Dynamic imports for optional dependencies - logs
let OTLPHttpLogExporter: any;
let OTLPGrpcLogExporter: any;
let OTLPProtoLogExporter: any;

// Dynamic imports for optional dependencies - metrics
let OTLPHttpMetricExporter: any;
let OTLPGrpcMetricExporter: any;
let OTLPProtoMetricExporter: any;

/**
 * Load a trace exporter for the given protocol.
 * Backward-compatible with existing usage.
 */
export async function loadExporter(protocol: ExportProtocol, provider?: string): Promise<any> {
  return loadSignalExporter('traces', protocol, provider);
}

/**
 * Load a signal-specific exporter for the given protocol.
 */
export async function loadSignalExporter(
  signal: SignalType,
  protocol: ExportProtocol,
  provider?: string,
): Promise<any> {
  switch (signal) {
    case 'traces':
      return loadTraceExporter(protocol, provider);
    case 'logs':
      return loadLogExporter(protocol, provider);
    case 'metrics':
      return loadMetricExporter(protocol, provider);
  }
}

async function loadTraceExporter(protocol: ExportProtocol, provider?: string): Promise<any> {
  switch (protocol) {
    case 'zipkin':
      if (!ZipkinExporter) {
        try {
          const module = await import('@opentelemetry/exporter-zipkin');
          ZipkinExporter = module.ZipkinExporter;
        } catch {
          console.error(
            `[OtelExporter] Zipkin exporter is not installed.\n` +
              `To use Zipkin export, install the required package:\n` +
              `  npm install @opentelemetry/exporter-zipkin`,
          );
          return null;
        }
      }
      return ZipkinExporter;

    case 'grpc':
      if (!OTLPGrpcTraceExporter) {
        try {
          const module = await import('@opentelemetry/exporter-trace-otlp-grpc');
          OTLPGrpcTraceExporter = module.OTLPTraceExporter;
        } catch {
          const providerInfo = provider ? ` (required for ${provider})` : '';
          console.error(
            `[OtelExporter] gRPC exporter is not installed${providerInfo}.\n` +
              `To use gRPC export, install the required packages:\n` +
              `  npm install @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js`,
          );
          return null;
        }
      }
      return OTLPGrpcTraceExporter;

    case 'http/protobuf':
      if (!OTLPProtoTraceExporter) {
        try {
          const module = await import('@opentelemetry/exporter-trace-otlp-proto');
          OTLPProtoTraceExporter = module.OTLPTraceExporter;
        } catch {
          const providerInfo = provider ? ` (required for ${provider})` : '';
          console.error(
            `[OtelExporter] HTTP/Protobuf exporter is not installed${providerInfo}.\n` +
              `To use HTTP/Protobuf export, install the required package:\n` +
              `  npm install @opentelemetry/exporter-trace-otlp-proto`,
          );
          return null;
        }
      }
      return OTLPProtoTraceExporter;

    case 'http/json':
    default:
      if (!OTLPHttpTraceExporter) {
        try {
          const module = await import('@opentelemetry/exporter-trace-otlp-http');
          OTLPHttpTraceExporter = module.OTLPTraceExporter;
        } catch {
          const providerInfo = provider ? ` (required for ${provider})` : '';
          console.error(
            `[OtelExporter] HTTP/JSON exporter is not installed${providerInfo}.\n` +
              `To use HTTP/JSON export, install the required package:\n` +
              `  npm install @opentelemetry/exporter-trace-otlp-http`,
          );
          return null;
        }
      }
      return OTLPHttpTraceExporter;
  }
}

async function loadLogExporter(protocol: ExportProtocol, provider?: string): Promise<any> {
  // Zipkin does not support logs
  if (protocol === 'zipkin') {
    console.warn('[OtelExporter] Zipkin does not support OTLP logs. Log export will be disabled.');
    return null;
  }

  switch (protocol) {
    case 'grpc':
      if (!OTLPGrpcLogExporter) {
        try {
          const module = await import('@opentelemetry/exporter-logs-otlp-grpc');
          OTLPGrpcLogExporter = module.OTLPLogExporter;
        } catch {
          const providerInfo = provider ? ` (required for ${provider})` : '';
          console.error(
            `[OtelExporter] gRPC log exporter is not installed${providerInfo}.\n` +
              `To export logs via gRPC, install the required packages:\n` +
              `  npm install @opentelemetry/exporter-logs-otlp-grpc @opentelemetry/sdk-logs @opentelemetry/api-logs @grpc/grpc-js`,
          );
          return null;
        }
      }
      return OTLPGrpcLogExporter;

    case 'http/protobuf':
      if (!OTLPProtoLogExporter) {
        try {
          const module = await import('@opentelemetry/exporter-logs-otlp-proto');
          OTLPProtoLogExporter = module.OTLPLogExporter;
        } catch {
          const providerInfo = provider ? ` (required for ${provider})` : '';
          console.error(
            `[OtelExporter] HTTP/Protobuf log exporter is not installed${providerInfo}.\n` +
              `To export logs via HTTP/Protobuf, install the required packages:\n` +
              `  npm install @opentelemetry/exporter-logs-otlp-proto @opentelemetry/sdk-logs @opentelemetry/api-logs`,
          );
          return null;
        }
      }
      return OTLPProtoLogExporter;

    case 'http/json':
    default:
      if (!OTLPHttpLogExporter) {
        try {
          const module = await import('@opentelemetry/exporter-logs-otlp-http');
          OTLPHttpLogExporter = module.OTLPLogExporter;
        } catch {
          const providerInfo = provider ? ` (required for ${provider})` : '';
          console.error(
            `[OtelExporter] HTTP/JSON log exporter is not installed${providerInfo}.\n` +
              `To export logs via HTTP/JSON, install the required packages:\n` +
              `  npm install @opentelemetry/exporter-logs-otlp-http @opentelemetry/sdk-logs @opentelemetry/api-logs`,
          );
          return null;
        }
      }
      return OTLPHttpLogExporter;
  }
}

async function loadMetricExporter(protocol: ExportProtocol, provider?: string): Promise<any> {
  // Zipkin does not support metrics
  if (protocol === 'zipkin') {
    console.warn('[OtelExporter] Zipkin does not support OTLP metrics. Metric export will be disabled.');
    return null;
  }

  switch (protocol) {
    case 'grpc':
      if (!OTLPGrpcMetricExporter) {
        try {
          const module = await import('@opentelemetry/exporter-metrics-otlp-grpc');
          OTLPGrpcMetricExporter = module.OTLPMetricExporter;
        } catch {
          const providerInfo = provider ? ` (required for ${provider})` : '';
          console.error(
            `[OtelExporter] gRPC metric exporter is not installed${providerInfo}.\n` +
              `To export metrics via gRPC, install the required packages:\n` +
              `  npm install @opentelemetry/exporter-metrics-otlp-grpc @opentelemetry/sdk-metrics @grpc/grpc-js`,
          );
          return null;
        }
      }
      return OTLPGrpcMetricExporter;

    case 'http/protobuf':
      if (!OTLPProtoMetricExporter) {
        try {
          const module = await import('@opentelemetry/exporter-metrics-otlp-proto');
          OTLPProtoMetricExporter = module.OTLPMetricExporter;
        } catch {
          const providerInfo = provider ? ` (required for ${provider})` : '';
          console.error(
            `[OtelExporter] HTTP/Protobuf metric exporter is not installed${providerInfo}.\n` +
              `To export metrics via HTTP/Protobuf, install the required packages:\n` +
              `  npm install @opentelemetry/exporter-metrics-otlp-proto @opentelemetry/sdk-metrics`,
          );
          return null;
        }
      }
      return OTLPProtoMetricExporter;

    case 'http/json':
    default:
      if (!OTLPHttpMetricExporter) {
        try {
          const module = await import('@opentelemetry/exporter-metrics-otlp-http');
          OTLPHttpMetricExporter = module.OTLPMetricExporter;
        } catch {
          const providerInfo = provider ? ` (required for ${provider})` : '';
          console.error(
            `[OtelExporter] HTTP/JSON metric exporter is not installed${providerInfo}.\n` +
              `To export metrics via HTTP/JSON, install the required packages:\n` +
              `  npm install @opentelemetry/exporter-metrics-otlp-http @opentelemetry/sdk-metrics`,
          );
          return null;
        }
      }
      return OTLPHttpMetricExporter;
  }
}
