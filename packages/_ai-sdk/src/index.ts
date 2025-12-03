// @internal/ai-sdk - Unified AI SDK vendor package
// Re-exports both V4 and V5 as namespaces

export * as v4 from './v4';
export * as v5 from './v5';

// Type helpers for version checking
export type SDKVersion = 'v4' | 'v5';
