/**
 * @internal/durable-agent-test-utils
 *
 * Shared test utilities for DurableAgent across execution engines.
 *
 * @example
 * ```typescript
 * import { createDurableAgentTestSuite } from '@internal/durable-agent-test-utils';
 * import { EventEmitterPubSub } from '@mastra/core/events';
 *
 * // Create a test suite with EventEmitterPubSub (default execution engine)
 * createDurableAgentTestSuite({
 *   name: 'DurableAgent',
 *   createPubSub: () => new EventEmitterPubSub(),
 * });
 *
 * // Create a test suite for Inngest
 * createDurableAgentTestSuite({
 *   name: 'DurableAgent (Inngest)',
 *   createPubSub: () => new EventEmitterPubSub(),
 *   eventPropagationDelay: 200,
 *   beforeAll: async () => {
 *     // Start Docker, create server, etc.
 *   },
 *   afterAll: async () => {
 *     // Cleanup
 *   },
 * });
 * ```
 */

// Main factory
export { createDurableAgentTestSuite } from './factory';

// Types
export type {
  DurableAgentTestConfig,
  DurableAgentTestContext,
  DurableAgentTestDomain,
  CreateAgentConfig,
  DurableAgentLike,
} from './types';

// Mock model factories
export {
  createTextStreamModel,
  createMultiChunkStreamModel,
  createToolCallModel,
  createMultiToolCallModel,
  createToolCallThenTextModel,
  createErrorModel,
  createSimpleMockModel,
  createReasoningStreamModel,
} from './mock-models';

// Domain test creators (for advanced customization)
export {
  createConstructorTests,
  createPrepareTests,
  createStreamTests,
  createCallbackTests,
  createToolsTests,
  createMemoryTests,
  createPubSubTests,
  // New domain test creators
  createAdvancedTests,
  createImagesTests,
  createReasoningTests,
  createRequestContextTests,
  createStopWhenTests,
  createStructuredOutputTests,
  createToolApprovalTests,
  createToolConcurrencyTests,
  createToolSuspensionTests,
  createUIMessageTests,
  createUsageTests,
  // Workspace tests
  createWorkspaceTests,
  // Additional domain tests
  createScorersTests,
  createStreamIdTests,
  createDynamicMemoryTests,
  createMemoryReadonlyTests,
  createMemoryRequestContextInheritanceTests,
  createReasoningMemoryTests,
  createV3FeaturesTests,
  createWorkingMemoryContextTests,
  createInputProcessorsTests,
  createSkillsWithCustomProcessorsTests,
  createTitleGenerationTests,
  createSaveAndErrorsTests,
  createMemoryMetadataTests,
} from './domains';
