/**
 * Dynamic loader for optional OtelExporters
 */

import type { ExportProtocol } from './types.js';

// Dynamic imports for optional dependencies
let OTLPHttpExporter: any;
let OTLPGrpcExporter: any;
let OTLPProtoExporter: any;
let ZipkinExporter: any;

export async function loadExporter(protocol: ExportProtocol, provider?: string): Promise<any> {
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
      if (!OTLPGrpcExporter) {
        try {
          const module = await import('@opentelemetry/exporter-trace-otlp-grpc');
          OTLPGrpcExporter = module.OTLPTraceExporter;
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
      return OTLPGrpcExporter;

    case 'http/protobuf':
      if (!OTLPProtoExporter) {
        try {
          const module = await import('@opentelemetry/exporter-trace-otlp-proto');
          OTLPProtoExporter = module.OTLPTraceExporter;
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
      return OTLPProtoExporter;

    case 'http/json':
    default:
      if (!OTLPHttpExporter) {
        try {
          const module = await import('@opentelemetry/exporter-trace-otlp-http');
          OTLPHttpExporter = module.OTLPTraceExporter;
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
      return OTLPHttpExporter;
  }
}
