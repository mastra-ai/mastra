/**
 * Domain test creators for DurableAgent and Workflows
 *
 * DurableAgent tests focus on observable behavior, not implementation details.
 * Tests should work for both DurableAgent and InngestDurableAgent.
 *
 * Workflow tests are designed to work across all workflow engines (default, evented, inngest).
 */

// === DurableAgent domain test creators ===

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

// === Workflow domain test creators ===

export { createBasicExecutionTests, createBasicExecutionWorkflows } from './basic-execution';
export { createVariableResolutionTests, createVariableResolutionWorkflows } from './variable-resolution';
export { createSimpleConditionsTests, createSimpleConditionsWorkflows } from './simple-conditions';
export { createComplexConditionsTests, createComplexConditionsWorkflows } from './complex-conditions';
export { createErrorHandlingTests, createErrorHandlingWorkflows } from './error-handling';
export { createLoopsTests, createLoopsWorkflows } from './loops';
export { createForeachTests, createForeachWorkflows } from './foreach';
export { createBranchingTests, createBranchingWorkflows } from './branching';
export { createSchemaValidationTests, createSchemaValidationWorkflows } from './schema-validation';
export { createMultipleChainsTests, createMultipleChainsWorkflows } from './multiple-chains';
export { createRetryTests, createRetryWorkflows } from './retry';
export { createSuspendResumeTests, createSuspendResumeWorkflows } from './suspend-resume';
export { createTimeTravelTests, createTimeTravelWorkflows } from './time-travel';
export { createNestedWorkflowsTests, createNestedWorkflowsWorkflows } from './nested-workflows';
export { createAgentStepTests, createAgentStepWorkflows } from './agent-step';
export { createDependencyInjectionTests, createDependencyInjectionWorkflows } from './dependency-injection';
export { createAbortTests, createAbortWorkflows } from './abort';
export { createInteroperabilityTests, createInteroperabilityWorkflows } from './interoperability';
export { createWorkflowRunsTests, createWorkflowRunsWorkflows } from './workflow-runs';
export { createCallbacksTests, createCallbacksWorkflows } from './callbacks';
export { createStreamingTests, createStreamingWorkflows } from './streaming';
export { createRestartTests, createRestartWorkflows } from './restart';
export { createPerStepTests, createPerStepWorkflows } from './per-step';
export { createTracingTests, createTracingWorkflows } from './tracing';
export { createStorageTests, createStorageWorkflows } from './storage';
export { createRunCountTests, createRunCountWorkflows } from './run-count';
export { createCloneTests, createCloneWorkflows } from './clone';
