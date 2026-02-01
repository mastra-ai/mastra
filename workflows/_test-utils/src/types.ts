/**
 * Types for workflow test factory
 */

import type { Workflow } from '@mastra/core/workflows';
import type { MastraStorage } from '@mastra/core/storage';

/**
 * Result of workflow execution - matches the core WorkflowResult type
 */
export interface WorkflowResult {
  status: 'success' | 'failed' | 'paused' | 'canceled';
  result?: unknown;
  error?: Error | unknown;
  steps: Record<string, StepResult>;
  state?: unknown;
}

export interface StepResult {
  status: 'success' | 'failed' | 'paused' | 'skipped';
  output?: unknown;
  payload?: unknown;
  error?: unknown;
  startedAt?: number;
  endedAt?: number;
}

/**
 * Function type for creating a step
 */
export type CreateStepFn = typeof import('@mastra/core/workflows').createStep;

/**
 * Function type for creating a workflow
 */
export type CreateWorkflowFn = typeof import('@mastra/core/workflows').createWorkflow;

/**
 * Function type for creating a tool
 */
export type CreateToolFn = typeof import('@mastra/core/tools').createTool;

/**
 * Test domains that can be selectively skipped
 */
export type WorkflowTestDomain =
  | 'basicExecution'
  | 'variableResolution'
  | 'simpleConditions'
  | 'complexConditions'
  | 'errorHandling'
  | 'loops'
  | 'foreach'
  | 'branching'
  | 'schemaValidation'
  | 'multipleChains'
  | 'retry'
  | 'suspendResume'
  | 'timeTravel'
  | 'nestedWorkflows'
  | 'agentStep'
  | 'dependencyInjection'
  | 'abort'
  | 'interoperability'
  | 'workflowRuns'
  | 'callbacks'
  | 'streaming'
  | 'restart'
  | 'perStep'
  | 'tracing'
  | 'storage'
  | 'runCount'
  | 'clone';

/**
 * Specific tests that can be skipped (for features not yet implemented in some engines)
 */
export type SkippableTest =
  // State-related tests (evented engine WIP)
  | 'state'
  // Error identity preservation (some engines serialize errors)
  | 'errorIdentity'
  // Schema validation throwing errors
  | 'schemaValidationThrows'
  // Abort returning 'canceled' status
  | 'abortStatus'
  // Empty array in foreach
  | 'emptyForeach'
  // Concurrent foreach timing (Inngest has network overhead per step)
  | 'foreachConcurrentTiming'
  // Partial concurrency foreach timing (Inngest has network overhead)
  | 'foreachPartialConcurrencyTiming'
  // Multiple levels of nested workflows
  | 'nestedMultipleLevels'
  // mapVariable from previous steps (some engines have memoization issues)
  | 'mapPreviousStep'
  // Nested workflow failure error checking
  | 'nestedWorkflowFailure'
  // Nested workflow data passing
  | 'nestedDataPassing'
  // Callback result verification (some engines have timing issues with callbacks)
  | 'callbackResult'
  // Error handling within nested workflows
  | 'nestedWorkflowErrors'
  // Error handling within parallel branches
  | 'parallelBranchErrors'
  // Error message format (some engines serialize errors and lose original message)
  | 'errorMessageFormat'
  // Branching else branch (some engines have memoization issues with nested workflows)
  | 'branchingElse'
  // Step execution order tracking (some engines have memoization issues with sequential steps)
  | 'stepExecutionOrder'
  // Non-object step outputs (some engines have issues with step memoization for non-object outputs)
  | 'nonObjectOutput'
  // requestContext propagation across steps (some engines don't support requestContext.set/get across steps)
  | 'requestContextPropagation'
  // getInitData helper (some engines have memoization issues with getInitData across steps)
  | 'getInitData'
  // Error cause chain preservation (some engines have memoization issues with error cause chains)
  | 'errorCauseChain'
  // Variable resolution error handling (Inngest has race condition with snapshot persistence)
  | 'variableResolutionErrors'
  // Foreach single concurrency (Inngest has race condition with snapshot persistence)
  | 'foreachSingleConcurrency'
  // Basic callback invocation (Inngest has timing issues with callback execution)
  | 'callbackOnFinish'
  // Error callback invocation (Inngest has timing issues with callback execution)
  | 'callbackOnError'
  // Until loop (Inngest has mock count issues across loop iterations)
  | 'loopUntil'
  // While loop (Inngest has mock count issues across loop iterations)
  | 'loopWhile'
  // onError callback should not be called when workflow succeeds
  | 'callbackOnErrorNotCalled'
  // Both onFinish and onError should be called when workflow fails
  | 'callbackBothOnFailure'
  // Async onFinish callback support
  | 'callbackAsyncOnFinish'
  // Async onError callback support
  | 'callbackAsyncOnError'
  // Error storage round-trip (requires storage to be configured)
  | 'errorStorageRoundtrip'
  // Restart tests - only work on Default engine
  | 'restartNotActive'
  | 'restartCompleted'
  | 'restartMultistep'
  | 'restartFailed'
  // perStep execution mode tests
  | 'perStepBasic'
  | 'perStepParallel'
  | 'perStepConditional'
  | 'perStepNested'
  | 'perStepContinue'
  // Tracing tests
  | 'tracingContext'
  | 'tracingMultistep'
  // Resume tests (require explicit resume() support)
  | 'resumeBasic'
  | 'resumeWithLabel'
  | 'resumeWithState'
  | 'resumeNested'
  | 'resumeParallelMulti'
  | 'resumeAutoDetect'
  | 'resumeBranchingStatus'
  | 'resumeConsecutiveNested'
  | 'resumeDountil'
  | 'resumeLoopInput'
  | 'resumeMapStep'
  | 'resumeForeach'
  // Storage tests (require storage to be configured)
  | 'storageListRuns'
  | 'storageGetDelete'
  | 'storageResourceId'
  // Run count tests
  | 'runCount'
  | 'retryCount'
  // Error persistence tests (require storage spy access)
  | 'errorPersistWithoutStack'
  | 'errorPersistMastraError'
  // Time travel tests
  | 'timeTravelBasic'
  | 'timeTravelPreviousRun'
  | 'timeTravelSuspended'
  | 'timeTravelNested'
  | 'timeTravelLoop'
  | 'timeTravelParallel'
  | 'timeTravelPerStep'
  | 'timeTravelConditional'
  | 'timeTravelSuspendResume'
  // Callback property tests
  | 'callbackRunId'
  | 'callbackWorkflowId'
  | 'callbackState'
  | 'callbackResourceId'
  | 'callbackSuspended'
  // Advanced callback tests
  | 'callbackGetInitData'
  | 'callbackLogger'
  | 'callbackRequestContext'
  // Clone tests
  | 'cloneWorkflows'
  | 'specResultVariables'
  // Advanced variable resolution tests
  | 'mapRequestContextPath'
  | 'mapDynamicFn'
  | 'mapCustomStepId'
  // Misc basic execution tests
  | 'executionFlowNotDefined'
  | 'executionGraphNotCommitted'
  | 'missingSuspendData'
  // Parallel suspend tests
  | 'resumeMultiSuspendError'
  // Foreach suspend tests
  | 'resumeForeachConcurrent'
  | 'resumeForeachIndex'
  // Storage result options tests
  | 'storageFieldsFilter'
  | 'storageWithNestedWorkflows';

/**
 * Configuration for creating a workflow test suite
 */
export interface WorkflowTestConfig {
  /**
   * Name for the describe block (e.g., "Workflow (Default Engine)")
   */
  name: string;

  /**
   * Get workflow factory functions.
   * For default/evented: returns core createWorkflow/createStep
   * For Inngest: returns init(inngest).createWorkflow/createStep
   */
  getWorkflowFactory: () => {
    createWorkflow: CreateWorkflowFn;
    createStep: CreateStepFn;
    createTool?: CreateToolFn;
  };

  /**
   * Execute a workflow and return the result.
   * This is where engine-specific execution logic lives.
   *
   * @param workflow - The workflow to execute
   * @param inputData - Input data for the workflow
   * @param options - Optional execution options
   */
  executeWorkflow: <T>(
    workflow: Workflow<any, any, any, any, any, any, any>,
    inputData: T,
    options?: ExecuteWorkflowOptions,
  ) => Promise<WorkflowResult>;

  /**
   * Resume a suspended workflow.
   * This is optional - only implement if the engine supports explicit resume testing.
   *
   * @param workflow - The workflow to resume
   * @param options - Resume options (runId, step/label, resumeData)
   */
  resumeWorkflow?: (
    workflow: Workflow<any, any, any, any, any, any, any>,
    options: ResumeWorkflowOptions,
  ) => Promise<WorkflowResult>;

  /**
   * Time travel to a specific step in a workflow.
   * This is optional - only implement if the engine supports time travel testing.
   *
   * @param workflow - The workflow to time travel
   * @param options - Time travel options (step, context)
   */
  timetravelWorkflow?: (
    workflow: Workflow<any, any, any, any, any, any, any>,
    options: TimeTravelWorkflowOptions,
  ) => Promise<WorkflowResult>;

  /**
   * Called with all workflows after they're created, before tests run.
   * Use this to register workflows with Mastra/Inngest.
   * Only needed for engines that require upfront registration (Inngest).
   */
  registerWorkflows?: (workflows: WorkflowRegistry) => Promise<void>;

  /**
   * Get the storage instance used by the engine.
   * This allows tests to spy on storage operations for verification.
   * Optional - only implement if tests need storage access.
   */
  getStorage?: () => MastraStorage | undefined;

  /**
   * Setup before all tests (e.g., start server, Docker)
   */
  beforeAll?: () => Promise<void>;

  /**
   * Cleanup after all tests (e.g., stop server)
   */
  afterAll?: () => Promise<void>;

  /**
   * Setup before each test
   */
  beforeEach?: () => Promise<void>;

  /**
   * Cleanup after each test
   */
  afterEach?: () => Promise<void>;

  /**
   * Skip certain test domains
   */
  skip?: Partial<Record<WorkflowTestDomain, boolean>>;

  /**
   * Skip specific tests (for features not yet implemented)
   * Use this for granular control over individual tests
   */
  skipTests?: Partial<Record<SkippableTest, boolean>>;

  /**
   * Run tests concurrently (useful for slow async engines like Inngest)
   * When true, tests will use it.concurrent instead of it
   */
  concurrent?: boolean;
}

/**
 * Options for executing a workflow
 */
export interface ExecuteWorkflowOptions {
  runId?: string;
  resourceId?: string;
  requestContext?: Record<string, unknown>;
  initialState?: Record<string, unknown>;
  perStep?: boolean;
}

/**
 * Options for resuming a workflow
 */
export interface ResumeWorkflowOptions {
  /** The run ID of the suspended workflow */
  runId: string;
  /** The step to resume (ID string or step reference) */
  step?: string | unknown;
  /** The label to resume (alternative to step) */
  label?: string;
  /** Data to pass to the resumed step */
  resumeData?: unknown;
  /** For foreach loops, the index to resume */
  forEachIndex?: number;
}

/**
 * Options for time traveling a workflow
 */
export interface TimeTravelWorkflowOptions {
  /** The step to time travel to (ID string or step reference) */
  step: string | unknown;
  /** The context to provide (step results from previous execution) */
  context: Record<string, {
    status: 'success' | 'failed' | 'paused' | 'skipped';
    output?: unknown;
    payload?: unknown;
    startedAt?: number;
    endedAt?: number;
    error?: unknown;
  }>;
  /** Optional run ID to use */
  runId?: string;
  /** Whether to run only one step (perStep mode) */
  perStep?: boolean;
}

/**
 * Function type for mapVariable
 */
export type MapVariableFn = typeof import('@mastra/core/workflows').mapVariable;

/**
 * Function type for cloneStep
 */
export type CloneStepFn = typeof import('@mastra/core/workflows').cloneStep;

/**
 * Function type for cloneWorkflow
 */
export type CloneWorkflowFn = typeof import('@mastra/core/workflows').cloneWorkflow;

/**
 * Context for workflow creators (subset of full context needed for workflow creation)
 */
export interface WorkflowCreatorContext {
  /**
   * Create a step for testing
   */
  createStep: CreateStepFn;

  /**
   * Create a workflow for testing
   */
  createWorkflow: CreateWorkflowFn;

  /**
   * Map a variable from a step or workflow
   */
  mapVariable: MapVariableFn;

  /**
   * Create a tool for testing (optional - for interoperability tests)
   */
  createTool?: CreateToolFn;

  /**
   * Clone a step with a new ID (optional - for clone tests)
   */
  cloneStep?: CloneStepFn;

  /**
   * Clone a workflow with a new ID (optional - for clone tests)
   */
  cloneWorkflow?: CloneWorkflowFn;
}

/**
 * Context passed to domain test creators
 */
export interface WorkflowTestContext extends WorkflowCreatorContext {
  /**
   * Execute a workflow and return the result
   */
  execute: <T>(
    workflow: Workflow<any, any, any, any, any, any, any>,
    inputData: T,
    options?: ExecuteWorkflowOptions,
  ) => Promise<WorkflowResult>;

  /**
   * Resume a suspended workflow.
   * Returns undefined if the engine doesn't support explicit resume testing.
   */
  resume?: (
    workflow: Workflow<any, any, any, any, any, any, any>,
    options: ResumeWorkflowOptions,
  ) => Promise<WorkflowResult>;

  /**
   * Time travel to a specific step in a workflow.
   * This allows re-running a workflow from a specific step with provided context.
   * Returns undefined if the engine doesn't support time travel testing.
   */
  timeTravel?: (
    workflow: Workflow<any, any, any, any, any, any, any>,
    options: TimeTravelWorkflowOptions,
  ) => Promise<WorkflowResult>;

  /**
   * Get the storage instance for spying on storage operations.
   * Returns undefined if storage access is not available.
   */
  getStorage?: () => MastraStorage | undefined;

  /**
   * Tests to skip (for features not yet implemented in this engine)
   */
  skipTests: Partial<Record<SkippableTest, boolean>>;

  /**
   * Whether tests should run concurrently
   */
  concurrent?: boolean;
}

/**
 * Entry in the workflow registry - contains workflow and associated test utilities
 */
export interface WorkflowRegistryEntry {
  workflow: Workflow<any, any, any, any, any, any, any>;
  mocks: Record<string, any>;
  /**
   * Reset mocks to fresh instances for test isolation.
   * Call this in beforeEach to prevent mock call count accumulation.
   */
  resetMocks?: () => void;
  // Optional getters/resetters for test state
  [key: string]: any;
}

/**
 * Registry of pre-created workflows for testing
 * Key is the workflow ID, value contains the workflow and test utilities
 */
export type WorkflowRegistry = Record<string, WorkflowRegistryEntry>;
