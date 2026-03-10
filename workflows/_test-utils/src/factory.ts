/**
 * Factory for creating workflow test suites
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { WorkflowTestConfig, WorkflowTestContext, WorkflowRegistry } from './types';

// Import domain workflow creators and test creators
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
