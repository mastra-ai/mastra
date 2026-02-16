/**
 * Domain test creators for DurableAgent
 *
 * These tests focus on observable behavior, not implementation details.
 * Tests should work for both DurableAgent and InngestDurableAgent.
 */

export { createConstructorTests } from './constructor';
export { createPrepareTests } from './prepare';
export { createStreamTests } from './stream';
export { createCallbackTests } from './callbacks';
export { createToolsTests } from './tools';
export { createMemoryTests } from './memory';
export { createPubSubTests } from './pubsub';

// Feature-specific test creators
export { createAdvancedTests } from './advanced';
export { createAdvancedDurableOnlyTests } from './advanced-durable-only';
export { createImagesTests } from './images';
export { createReasoningTests } from './reasoning';
export { createRequestContextTests } from './request-context';
export { createStopWhenTests } from './stopwhen';
export { createStructuredOutputTests } from './structured-output';
export { createToolApprovalTests } from './tool-approval';
export { createToolConcurrencyTests } from './tool-concurrency';
export { createToolSuspensionTests } from './tool-suspension';
export { createUIMessageTests } from './uimessage';
export { createUsageTests } from './usage';

// Model fallback tests
export { createModelFallbackTests } from './model-fallback';
export { createModelFallbackRuntimeTests } from './model-fallback-runtime';

// Observe tests (resumable streams)
export { createObserveTests } from './observe';

// Workspace tests
export { createWorkspaceTests } from './workspace';

// Additional domain tests (from agent test suite)
export { createScorersTests } from './scorers';
export { createStreamIdTests } from './stream-id';
export { createDynamicMemoryTests } from './dynamic-memory';
export { createMemoryReadonlyTests } from './memory-readonly';
export { createMemoryRequestContextInheritanceTests } from './memory-requestcontext-inheritance';
export { createReasoningMemoryTests } from './reasoning-memory';
export { createV3FeaturesTests } from './v3-features';
export { createWorkingMemoryContextTests } from './working-memory-context';
export { createInputProcessorsTests } from './input-processors';
export { createSkillsWithCustomProcessorsTests } from './skills-with-custom-processors';
export { createTitleGenerationTests } from './title-generation';
export { createSaveAndErrorsTests } from './save-and-errors';
export { createMemoryMetadataTests } from './memory-metadata';
