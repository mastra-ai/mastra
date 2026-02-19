/**
 * Factory for creating DurableAgent and Workflow test suites
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { PubSub } from '@mastra/core/events';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import type {
  DurableAgentTestConfig,
  DurableAgentTestContext,
  DurableAgentTestDomain,
  CreateAgentConfig,
  DurableAgentLike,
  WorkflowTestConfig,
  WorkflowTestContext,
  WorkflowRegistry,
} from './types';
import {
  createConstructorTests,
  createPrepareTests,
  createStreamTests,
  createCallbackTests,
  createToolsTests,
  createMemoryTests,
  createPubSubTests,
  // New domain test creators
  createAdvancedTests,
  createAdvancedDurableOnlyTests,
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
  // Model fallback test creators
  createModelFallbackTests,
  createModelFallbackRuntimeTests,
  // Observe test creators
  createObserveTests,
  // Workspace test creators
  createWorkspaceTests,
  // Additional domain test creators
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

// Workflow domain imports (imported directly to avoid circular deps with domains/index)
import { createBasicExecutionWorkflows, createBasicExecutionTests } from './domains/basic-execution';
import { createVariableResolutionWorkflows, createVariableResolutionTests } from './domains/variable-resolution';
import { createSimpleConditionsWorkflows, createSimpleConditionsTests } from './domains/simple-conditions';
import { createComplexConditionsWorkflows, createComplexConditionsTests } from './domains/complex-conditions';
import { createErrorHandlingWorkflows, createErrorHandlingTests } from './domains/error-handling';
import { createLoopsWorkflows, createLoopsTests } from './domains/loops';
import { createForeachWorkflows, createForeachTests } from './domains/foreach';
import { createBranchingWorkflows, createBranchingTests } from './domains/branching';
import { createSchemaValidationWorkflows, createSchemaValidationTests } from './domains/schema-validation';
import { createMultipleChainsWorkflows, createMultipleChainsTests } from './domains/multiple-chains';
import { createRetryWorkflows, createRetryTests } from './domains/retry';
import { createSuspendResumeWorkflows, createSuspendResumeTests } from './domains/suspend-resume';
import { createTimeTravelWorkflows, createTimeTravelTests } from './domains/time-travel';
import { createNestedWorkflowsWorkflows, createNestedWorkflowsTests } from './domains/nested-workflows';
import { createAgentStepWorkflows, createAgentStepTests } from './domains/agent-step';
import { createDependencyInjectionWorkflows, createDependencyInjectionTests } from './domains/dependency-injection';
import { createAbortWorkflows, createAbortTests } from './domains/abort';
import { createInteroperabilityWorkflows, createInteroperabilityTests } from './domains/interoperability';
import { createWorkflowRunsWorkflows, createWorkflowRunsTests } from './domains/workflow-runs';
import { createCallbacksWorkflows, createCallbacksTests } from './domains/callbacks';
import { createStreamingWorkflows, createStreamingTests } from './domains/streaming';
import { createRestartWorkflows, createRestartTests } from './domains/restart';
import { createPerStepWorkflows, createPerStepTests } from './domains/per-step';
import { createTracingWorkflows, createTracingTests } from './domains/tracing';
import { createStorageWorkflows, createStorageTests } from './domains/storage';
import { createRunCountWorkflows, createRunCountTests } from './domains/run-count';
import { createCloneWorkflows, createCloneTests } from './domains/clone';

// ============================================================
// DurableAgent test suite factory
// ============================================================

const DEFAULT_EVENT_PROPAGATION_DELAY = 100;

/**
 * Default agent factory - creates DurableAgent with pubsub from context
 */
function defaultCreateAgent(config: CreateAgentConfig, context: DurableAgentTestContext): DurableAgentLike {
  const pubsub = context.getPubSub();
  const agent = new Agent({
    id: config.id,
    name: config.name || config.id,
    instructions: config.instructions,
    model: config.model,
    tools: config.tools,
  });
  return createDurableAgent({ agent, pubsub });
}

/**
 * Create a complete DurableAgent test suite
 *
 * @example
 * ```typescript
 * import { createDurableAgentTestSuite } from '@internal/workflow-test-utils';
 * import { EventEmitterPubSub } from '@mastra/core/events';
 *
 * createDurableAgentTestSuite({
 *   name: 'DurableAgent',
 *   createPubSub: () => new EventEmitterPubSub(),
 * });
 * ```
 */
export function createDurableAgentTestSuite(config: DurableAgentTestConfig) {
  const { name, createPubSub, cleanupPubSub } = config;
  const skip: Partial<Record<DurableAgentTestDomain, boolean>> = config.skip ?? {};
  const eventPropagationDelay = config.eventPropagationDelay ?? DEFAULT_EVENT_PROPAGATION_DELAY;
  const agentFactory = config.createAgent ?? defaultCreateAgent;

  let pubsub: PubSub;

  describe(name, () => {
    beforeAll(async () => {
      if (config.beforeAll) {
        await config.beforeAll();
      }
    });

    afterAll(async () => {
      if (config.afterAll) {
        await config.afterAll();
      }
    });

    beforeEach(async () => {
      // Create fresh pubsub for each test
      pubsub = await Promise.resolve(createPubSub());

      if (config.beforeEach) {
        await config.beforeEach();
      }
    });

    afterEach(async () => {
      if (config.afterEach) {
        await config.afterEach();
      }

      // Cleanup pubsub
      if (cleanupPubSub) {
        await cleanupPubSub(pubsub);
      } else if (pubsub && 'close' in pubsub && typeof (pubsub as any).close === 'function') {
        await (pubsub as any).close();
      }
    });

    // Create test context with agent factory
    const context: DurableAgentTestContext = {
      getPubSub: () => pubsub,
      createAgent: async (agentConfig: CreateAgentConfig) => {
        return Promise.resolve(agentFactory(agentConfig, context));
      },
      eventPropagationDelay,
    };

    // Register domain tests conditionally
    if (!skip.constructor) {
      createConstructorTests(context);
    }

    if (!skip.prepare) {
      createPrepareTests(context);
    }

    if (!skip.stream) {
      createStreamTests(context);
    }

    if (!skip.callbacks) {
      createCallbackTests(context);
    }

    if (!skip.tools) {
      createToolsTests(context);
    }

    if (!skip.memory) {
      createMemoryTests(context);
    }

    if (!skip.pubsub) {
      createPubSubTests(context);
    }

    // New domain tests
    if (!skip.advanced) {
      createAdvancedTests(context);
    }

    // DurableAgent-specific tests (registry, lazy init) - skip for InngestDurableAgent
    if (!skip.advancedDurableOnly) {
      createAdvancedDurableOnlyTests(context);
    }

    if (!skip.images) {
      createImagesTests(context);
    }

    if (!skip.reasoning) {
      createReasoningTests(context);
    }

    if (!skip.requestContext) {
      createRequestContextTests(context);
    }

    if (!skip.stopWhen) {
      createStopWhenTests(context);
    }

    if (!skip.structuredOutput) {
      createStructuredOutputTests(context);
    }

    if (!skip.toolApproval) {
      createToolApprovalTests(context);
    }

    if (!skip.toolConcurrency) {
      createToolConcurrencyTests(context);
    }

    if (!skip.toolSuspension) {
      createToolSuspensionTests(context);
    }

    if (!skip.uiMessage) {
      createUIMessageTests(context);
    }

    if (!skip.usage) {
      createUsageTests(context);
    }

    // Model fallback tests
    if (!skip.modelFallback) {
      createModelFallbackTests(context);
    }

    // Model fallback runtime tests (DurableAgent only - requires registry)
    if (!skip.modelFallbackRuntime) {
      createModelFallbackRuntimeTests(context);
    }

    // Observe tests (resumable streams)
    if (!skip.observe) {
      createObserveTests(context);
    }

    // Workspace tests
    if (!skip.workspace) {
      createWorkspaceTests(context);
    }

    // Additional domain tests
    if (!skip.scorers) {
      createScorersTests(context);
    }

    if (!skip.streamId) {
      createStreamIdTests(context);
    }

    if (!skip.dynamicMemory) {
      createDynamicMemoryTests(context);
    }

    if (!skip.memoryReadonly) {
      createMemoryReadonlyTests(context);
    }

    if (!skip.memoryRequestContextInheritance) {
      createMemoryRequestContextInheritanceTests(context);
    }

    if (!skip.reasoningMemory) {
      createReasoningMemoryTests(context);
    }

    if (!skip.v3Features) {
      createV3FeaturesTests(context);
    }

    if (!skip.workingMemoryContext) {
      createWorkingMemoryContextTests(context);
    }

    if (!skip.inputProcessors) {
      createInputProcessorsTests(context);
    }

    if (!skip.skillsWithCustomProcessors) {
      createSkillsWithCustomProcessorsTests(context);
    }

    if (!skip.titleGeneration) {
      createTitleGenerationTests(context);
    }

    if (!skip.saveAndErrors) {
      createSaveAndErrorsTests(context);
    }

    if (!skip.memoryMetadata) {
      createMemoryMetadataTests(context);
    }
  });
}

// ============================================================
// Workflow test suite factory
// ============================================================

/**
 * Create a complete workflow test suite
 *
 * @example
 * ```typescript
 * import { createWorkflowTestSuite } from '@internal/workflow-test-utils';
 * import { createWorkflow, createStep } from '@mastra/core/workflows';
 *
 * createWorkflowTestSuite({
 *   name: 'Workflow (Default Engine)',
 *   getWorkflowFactory: () => ({ createWorkflow, createStep }),
 *   executeWorkflow: async (workflow, input) => {
 *     const run = await workflow.createRun();
 *     return run.start({ inputData: input });
 *   },
 * });
 * ```
 */
export function createWorkflowTestSuite(config: WorkflowTestConfig) {
  const { name, getWorkflowFactory, executeWorkflow, skip = {}, skipTests = {} } = config;

  describe(name, () => {
    // Create workflow factory - this runs at test collection time
    const factory = getWorkflowFactory();
    const { mapVariable, cloneStep, cloneWorkflow } = require('@mastra/core/workflows');

    // Create all workflows upfront
    // Domains that support the new pattern will have workflow creators
    const registry: WorkflowRegistry = {};

    // Context for workflow creators
    const creatorContext = {
      createWorkflow: factory.createWorkflow,
      createStep: factory.createStep,
      createTool: factory.createTool,
      Agent: factory.Agent,
      mapVariable,
      cloneStep,
      cloneWorkflow,
    };

    // Create workflows from each domain
    if (!skip.basicExecution) {
      Object.assign(registry, createBasicExecutionWorkflows(creatorContext));
    }

    if (!skip.variableResolution) {
      Object.assign(registry, createVariableResolutionWorkflows(creatorContext));
    }

    if (!skip.simpleConditions) {
      Object.assign(registry, createSimpleConditionsWorkflows(creatorContext));
    }

    if (!skip.complexConditions) {
      Object.assign(registry, createComplexConditionsWorkflows(creatorContext));
    }

    if (!skip.errorHandling) {
      Object.assign(registry, createErrorHandlingWorkflows(creatorContext));
    }

    if (!skip.loops) {
      Object.assign(registry, createLoopsWorkflows(creatorContext));
    }

    if (!skip.foreach) {
      Object.assign(registry, createForeachWorkflows(creatorContext));
    }

    if (!skip.branching) {
      Object.assign(registry, createBranchingWorkflows(creatorContext));
    }

    if (!skip.schemaValidation) {
      Object.assign(registry, createSchemaValidationWorkflows(creatorContext));
    }

    if (!skip.multipleChains) {
      Object.assign(registry, createMultipleChainsWorkflows(creatorContext));
    }

    if (!skip.retry) {
      Object.assign(registry, createRetryWorkflows(creatorContext));
    }

    if (!skip.suspendResume) {
      Object.assign(registry, createSuspendResumeWorkflows(creatorContext));
    }

    if (!skip.timeTravel) {
      Object.assign(registry, createTimeTravelWorkflows(creatorContext));
    }

    if (!skip.nestedWorkflows) {
      Object.assign(registry, createNestedWorkflowsWorkflows(creatorContext));
    }

    if (!skip.agentStep) {
      Object.assign(registry, createAgentStepWorkflows(creatorContext));
    }

    if (!skip.dependencyInjection) {
      Object.assign(registry, createDependencyInjectionWorkflows(creatorContext));
    }

    if (!skip.abort) {
      Object.assign(registry, createAbortWorkflows(creatorContext));
    }

    if (!skip.interoperability) {
      Object.assign(registry, createInteroperabilityWorkflows(creatorContext));
    }

    if (!skip.workflowRuns) {
      Object.assign(registry, createWorkflowRunsWorkflows(creatorContext));
    }

    if (!skip.callbacks) {
      Object.assign(registry, createCallbacksWorkflows(creatorContext));
    }

    if (!skip.streaming) {
      Object.assign(registry, createStreamingWorkflows(creatorContext));
    }

    if (!skip.restart) {
      Object.assign(registry, createRestartWorkflows(creatorContext));
    }

    if (!skip.perStep) {
      Object.assign(registry, createPerStepWorkflows(creatorContext));
    }

    if (!skip.tracing) {
      Object.assign(registry, createTracingWorkflows(creatorContext));
    }

    if (!skip.storage) {
      Object.assign(registry, createStorageWorkflows(creatorContext));
    }

    if (!skip.runCount) {
      Object.assign(registry, createRunCountWorkflows(creatorContext));
    }

    if (!skip.clone) {
      Object.assign(registry, createCloneWorkflows(creatorContext));
    }

    // Create test context
    const context: WorkflowTestContext = {
      createWorkflow: factory.createWorkflow,
      createStep: factory.createStep,
      mapVariable,
      cloneStep,
      cloneWorkflow,
      execute: executeWorkflow,
      resume: config.resumeWorkflow,
      timeTravel: config.timetravelWorkflow,
      stream: config.streamWorkflow,
      streamResume: config.streamResumeWorkflow,
      getStorage: config.getStorage,
      skipTests,
      concurrent: config.concurrent,
    };

    beforeAll(async () => {
      // Register workflows with engine (for Inngest)
      if (config.registerWorkflows) {
        await config.registerWorkflows(registry);
      }

      if (config.beforeAll) {
        await config.beforeAll();
      }
    });

    afterAll(async () => {
      if (config.afterAll) {
        await config.afterAll();
      }
    });

    beforeEach(async () => {
      // Reset all mocks in registry entries for test isolation
      for (const entry of Object.values(registry)) {
        entry.resetMocks?.();
      }

      if (config.beforeEach) {
        await config.beforeEach();
      }
    });

    afterEach(async () => {
      if (config.afterEach) {
        await config.afterEach();
      }
    });

    // Register domain tests - all using new pattern with registry
    if (!skip.basicExecution) {
      createBasicExecutionTests(context, registry);
    }

    if (!skip.variableResolution) {
      createVariableResolutionTests(context, registry);
    }

    if (!skip.simpleConditions) {
      createSimpleConditionsTests(context, registry);
    }

    if (!skip.complexConditions) {
      createComplexConditionsTests(context, registry);
    }

    if (!skip.errorHandling) {
      createErrorHandlingTests(context, registry);
    }

    if (!skip.loops) {
      createLoopsTests(context, registry);
    }

    if (!skip.foreach) {
      createForeachTests(context, registry);
    }

    if (!skip.branching) {
      createBranchingTests(context, registry);
    }

    if (!skip.schemaValidation) {
      createSchemaValidationTests(context, registry);
    }

    if (!skip.multipleChains) {
      createMultipleChainsTests(context, registry);
    }

    if (!skip.retry) {
      createRetryTests(context, registry);
    }

    if (!skip.suspendResume) {
      createSuspendResumeTests(context, registry);
    }

    if (!skip.timeTravel) {
      createTimeTravelTests(context, registry);
    }

    if (!skip.nestedWorkflows) {
      createNestedWorkflowsTests(context, registry);
    }

    if (!skip.agentStep) {
      createAgentStepTests(context, registry);
    }

    if (!skip.dependencyInjection) {
      createDependencyInjectionTests(context, registry);
    }

    if (!skip.abort) {
      createAbortTests(context, registry);
    }

    if (!skip.interoperability) {
      createInteroperabilityTests(context, registry);
    }

    if (!skip.workflowRuns) {
      createWorkflowRunsTests(context, registry);
    }

    if (!skip.callbacks) {
      createCallbacksTests(context, registry);
    }

    if (!skip.streaming) {
      createStreamingTests(context, registry);
    }

    if (!skip.restart) {
      createRestartTests(context, registry);
    }

    if (!skip.perStep) {
      createPerStepTests(context, registry);
    }

    if (!skip.tracing) {
      createTracingTests(context, registry);
    }

    if (!skip.storage) {
      createStorageTests(context, registry);
    }

    if (!skip.runCount) {
      createRunCountTests(context, registry);
    }

    if (!skip.clone) {
      createCloneTests(context, registry);
    }
  });
}
