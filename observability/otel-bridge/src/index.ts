/**
 * @mastra/otel-bridge
 *
 * OpenTelemetry bridge for Mastra - enables in-process interop with existing OpenTelemetry traces
 *
 * Use this package to make Mastra participate in your application's existing OpenTelemetry
 * trace context. The bridge will:
 * - Read the current OTEL context and create Mastra spans as children
 * - Mirror Mastra span lifecycle to OTEL spans
 * - Respect OTEL sampling decisions
 * - Map Mastra attributes to OTEL semantic conventions
 *
 * @example
 * ```typescript
 * import { OtelBridge } from '@mastra/otel-bridge';
 *
 * const tracing = new MastraTracing({
 *   exporters: [
 *     new OtelBridge({
 *       tracerName: 'mastra',
 *       attributePrefix: 'mastra.',
 *       forceExport: false,
 *     }),
 *   ],
 * });
 * ```
 */

export { OtelBridge } from './otel-bridge.js';
export { AttributeMapper } from './attribute-mapper.js';
export type { OtelBridgeConfig, BridgedSpanData, BridgedSpanRegistry } from './types.js';
