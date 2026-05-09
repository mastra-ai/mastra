/**
 * Mastra Observability Package
 *
 * Core observability package for Mastra applications.
 * This package includes tracing and scoring features.
 */

// Export the default observability class
export { Observability } from './default';

// Export configuration types
export * from './config';

// Export all implementations
export * from './bus';
export * from './context';
export * from './instances';
export * from './metrics';
export * from './spans';

export * from './exporters';
export * from './span_processors';
export * from './model-tracing';

// Feature flags — see ./features.ts for the safe access pattern when the
// dependency may be older than this export.
export * from './features';

// Export tracing options builder utilities
export * from './tracing-options';
