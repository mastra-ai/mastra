/**
 * @internal/test-utils
 *
 * Internal test utilities for Mastra packages.
 * Not for public consumption - use for Mastra package testing only.
 *
 * @example
 * ```typescript
 * import { useLLMRecording } from '@internal/test-utils';
 *
 * describe('My Tests', () => {
 *   // Automatically handles setup/teardown
 *   const recording = useLLMRecording('my-tests');
 *
 *   it('generates text', async () => {
 *     const result = await agent.generate('Hello');
 *     expect(result.text).toBeDefined();
 *   });
 *
 *   it('streams text', async () => {
 *     const { textStream } = await agent.stream('Count to 3');
 *     const chunks = [];
 *     for await (const chunk of textStream) {
 *       chunks.push(chunk);
 *     }
 *     expect(chunks.length).toBeGreaterThan(0);
 *   });
 * });
 * ```
 *
 * ## Recording Mode
 *
 * To record new fixtures (or refresh existing ones):
 * ```bash
 * RECORD_LLM=true pnpm test
 * ```
 *
 * Recordings are stored in `__recordings__/` as human-readable JSON.
 */

// Main API - unified MSW-based recorder
export * from './llm-recorder';

// Contract validation for nightly tests
export * from './llm-contract';

// Common test helpers to reduce boilerplate
export * from './llm-helpers';
