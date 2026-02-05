/**
 * Mastra Observability
 *
 * Core observability utilities and types. To use observability, install
 * @mastra/observability and pass an Observability instance to Mastra constructor.
 */

// Re-export core types & entrypoint class
export * from './types';
export * from './no-op';
export * from './utils';
export { wrapMastra } from './context';
export { createObservabilityContext, resolveObservabilityContext } from './context-factory';
