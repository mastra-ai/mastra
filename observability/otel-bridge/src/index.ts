/**
 * @mastra/otel-bridge
 *
 * OpenTelemetry Bridge for Mastra Observability
 *
 * Provides integration with existing OTEL infrastructure:
 * - Reads from OTEL ambient context (AsyncLocalStorage) automatically
 * - Extracts W3C trace context from headers when needed
 * - Works with standard OTEL auto-instrumentation
 *
 * @example Standard OTEL Setup
 * ```typescript
 * // instrumentation.js (import FIRST, before other code)
 * import { NodeSDK } from '@opentelemetry/sdk-node';
 * import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
 *
 * const sdk = new NodeSDK({
 *   serviceName: 'my-service',
 *   instrumentations: [getNodeAutoInstrumentations()],
 * });
 * sdk.start();
 * ```
 *
 * @example Mastra Configuration
 * ```typescript
 * import { OtelBridge } from '@mastra/otel-bridge';
 * import { Mastra } from '@mastra/core';
 * import { Observability } from '@mastra/observability';
 *
 * const mastra = new Mastra({
 *   observability: new Observability({
 *     configs: {
 *       default: {
 *         serviceName: 'my-service',
 *         bridge: new OtelBridge(),
 *       }
 *     }
 *   })
 * });
 * ```
 *
 * @example Next.js Edge Runtime
 * ```typescript
 * // middleware.ts
 * export { nextjsMiddleware as middleware } from '@mastra/otel-bridge/nextjs-middleware';
 * ```
 */

// Core bridge
export { OtelBridge } from './bridge.js';
export type { OtelBridgeConfig } from './bridge.js';

// Helper functions
export { extractOtelHeaders, createOtelContext } from './helpers.js';
