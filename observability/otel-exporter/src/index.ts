export { OtelExporter } from './tracing.js';
export { SpanConverter, getSpanKind } from './span-converter.js';
export { getAttributes, getSpanName } from './gen-ai-semantics.js';
export { convertLog, mapSeverity, buildLogAttributes } from './log-converter.js';
export { MetricInstrumentCache, convertLabels, getOtelInstrumentType } from './metric-converter.js';
export type { OtelLogEmitParams } from './log-converter.js';
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
