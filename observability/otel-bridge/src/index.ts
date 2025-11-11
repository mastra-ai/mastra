/**
 * @mastra/otel-bridge
 *
 * OpenTelemetry Bridge for Mastra Observability
 *
 * Enables integration with existing OTEL infrastructure through:
 * - Context extraction from active OTEL spans or W3C trace headers
 * - Context injection into Mastra span creation
 * - Framework-agnostic middleware for Express, Fastify, and Hono
 *
 * @example
 * ```typescript
 * import { OtelBridge } from '@mastra/otel-bridge';
 * import { Mastra } from '@mastra/core';
 *
 * const mastra = new Mastra({
 *   observability: {
 *     configs: {
 *       default: {
 *         serviceName: 'my-service',
 *         bridge: new OtelBridge({
 *           extractFrom: 'both',
 *         }),
 *       }
 *     }
 *   }
 * });
 * ```
 */

// Core bridge
export { OtelBridge } from './bridge.js';
export type { OtelBridgeConfig } from './bridge.js';

// Helper functions
export { extractOtelHeaders, createOtelContext } from './helpers.js';

// Middleware (re-exported with framework-specific names)
export { otelMiddleware as expressMiddleware } from './middleware/express.js';
export { otelPlugin as fastifyPlugin } from './middleware/fastify.js';
export { otelMiddleware as honoMiddleware } from './middleware/hono.js';
export { nextjsMiddleware, getNextOtelContext } from './middleware/nextjs.js';
