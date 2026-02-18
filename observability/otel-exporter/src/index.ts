export { OtelExporter } from './tracing.js';
export { SpanConverter, getSpanKind } from './span-converter.js';
export { getAttributes, getSpanName } from './gen-ai-semantics.js';
export type {
  OtelExporterConfig,
  ProviderConfig,
  Dash0Config,
  SignozConfig,
  NewRelicConfig,
  TraceloopConfig,
  LaminarConfig,
  GrafanaCloudConfig,
  CustomConfig,
  ExportProtocol,
} from './types.js';
