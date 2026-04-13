/**
 * Client observability for @mastra/observability.
 *
 * Implements the ClientObservabilityProxy interface from @mastra/core
 * to bridge OTLP/JSON spans and logs returned by client-side execution
 * (via the @mastra/client-js collector) into the Mastra observability
 * bus.
 */

export { createClientObservabilityProxy, DEFAULT_LIMITS } from './proxy';
export type { ClientObservabilityProxyLimits, CreateClientObservabilityProxyOptions } from './proxy';
export {
  decodeResourceLogs,
  decodeResourceSpans,
  buildExportedLog,
  buildExportedSpan,
  otlpSeverityToLogLevel,
} from './otlp';
export type { DecodedOtlpLog, DecodedOtlpSpan } from './otlp';
export { formatBaggage, formatTraceparent, parseBaggage, parseTraceparent } from './w3c';
export type { TraceparentParts } from './w3c';
