/**
 * @internal/test-utils
 *
 * Mastra-specific test helpers for internal packages.
 * Provides version-agnostic agent wrappers, dummy API key setup, and model config utilities.
 *
 * For LLM recording/replay, use `@internal/llm-recorder` instead.
 *
 * @example
 * ```typescript
 * import { setupDummyApiKeys, getModelRecordingName, agentGenerate } from '@internal/test-utils';
 * import { getLLMTestMode } from '@internal/llm-recorder';
 *
 * setupDummyApiKeys(getLLMTestMode(), ['openai']);
 * ```
 */

// Mastra-specific test helpers
export * from './llm-helpers';
