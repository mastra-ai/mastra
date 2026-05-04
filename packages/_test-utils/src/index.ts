/**
 * @internal/test-utils
 *
 * Mastra-specific test helpers for internal packages.
 * Provides version-agnostic agent wrappers, dummy API key setup, and LLM mocking.
 *
 * @example
 * ```typescript
 * import { createLLMMock, agentGenerate, getModelRecordingName } from '@internal/test-utils';
 * ```
 */

// Mastra-specific test helpers
export * from './llm-helpers';

// LLM mocking
export * from './llm-mock';
