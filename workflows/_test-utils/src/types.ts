/**
 * Types for workflow test factory
 */

import type { Workflow } from '@mastra/core/workflows';
import type { MastraStorage } from '@mastra/core/storage';

/**
 * Stream event from workflow streaming APIs
 */
export interface StreamEvent {
  type: string;
  payload?: Record<string, unknown>;
  from?: string;
  runId?: string;
  [key: string]: unknown;
}

/**
 * Result of streaming a workflow - includes events and final result
 */
export interface StreamWorkflowResult {
  events: StreamEvent[];
  result: WorkflowResult;
}

/**
 * Result of workflow execution - matches the core WorkflowResult type
 */
export interface WorkflowResult {
  status: 'success' | 'failed' | 'paused' | 'canceled' | 'suspended' | 'tripwire';
  result?: unknown;
  error?: Error | unknown;
  steps: Record<string, StepResult>;
  state?: unknown;
}

export interface StepResult {
  status: 'success' | 'failed' | 'paused' | 'skipped' | 'suspended';
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
 * Agent class type for creating agent steps
 */
export type AgentClass = typeof import('@mastra/core/agent').Agent;

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
  // Schema validation with .map() step
  | 'schemaMapValidation'
  // Schema validation - structured output from agent step
  | 'schemaStructuredOutput'
  // Schema validation in nested workflows
  | 'schemaNestedValidation'
  // ZodError cause preservation when validation fails
  | 'schemaZodErrorCause'
  // waitForEvent removed error
  | 'schemaWaitForEvent'
  // Abort returning 'canceled' status
  | 'abortStatus'
  // Abort signal during step execution (requires 5s timeout, skipped by default)
  | 'abortDuringStep'
  // Abort signal propagation to nested workflow (requires direct run access)
  | 'abortNestedPropagation'
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
  | 'restartParallel'
  // perStep execution mode tests
  | 'perStepBasic'
  | 'perStepParallel'
  | 'perStepConditional'
  | 'perStepNested'
  | 'perStepContinue'
  // Tracing tests
  | 'tracingContext'
  | 'tracingMultistep'
  // Tracing TypeScript support (compile-time test)
  | 'tracingTypeScript'
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
  // Resume nested workflow with [workflow, step] path reference
  | 'resumeNestedWithPath'
  // Resume nested workflow with only nested workflow step ID (string)
  | 'resumeNestedOnlyWfStep'
  // Preserve request context in nested workflows after suspend/resume
  | 'resumeNestedRequestContext'
  // Deep nesting: suspend nested workflow step inside a nested workflow step
  | 'resumeDeepNested'
  // Incorrect branches should not execute after resuming from suspended nested workflow
  | 'resumeIncorrectBranches'
  // Correct inputData to branch condition when resuming after map step
  | 'resumeMapBranchCondition'
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
  | 'timeTravelPreviousRunPerStep'
  | 'timeTravelParallelPerStep'
  | 'timeTravelConditionalPerStep'
  // Time travel error: workflow still running
  | 'timeTravelErrorRunning'
  // Time travel error: invalid inputData with validateInputs
  | 'timeTravelErrorInvalidInput'
  // Callback property tests
  | 'callbackRunId'
  | 'callbackWorkflowId'
  | 'callbackState'
  | 'callbackResourceId'
  | 'callbackSuspended'
  // Mastra instance in callbacks
  | 'callbackMastraOnFinish'
  | 'callbackMastraOnError'
  // Error callback property tests
  | 'callbackResourceIdOnError'
  | 'callbackStateOnError'
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
  // Suspend data access on resume
  | 'suspendDataAccess'
  // Parallel suspend tests
  | 'resumeMultiSuspendError'
  // Foreach suspend tests
  | 'resumeForeachConcurrent'
  | 'resumeForeachIndex'
  // Storage result options tests
  | 'storageFieldsFilter'
  | 'storageWithNestedWorkflows'
  // Agent step tests
  | 'agentStepDeepNested'
  // Agent step via mastra instance (requires Mastra registration with agents)
  | 'agentStepMastraInstance'
  // Agent step in nested workflow via mastra instance
  | 'agentStepNestedMastraInstance'
  // Streaming suspend/resume tests
  | 'streamingSuspendResume'
  // Streaming error property preservation
  | 'streamingErrorPreservation'
  // Streaming tripwire from agent input processor
  | 'streamingTripwireInput'
  // Streaming tripwire status when streaming agent
  | 'streamingTripwireStreaming'
  // Streaming tripwire from output stream processor
  | 'streamingTripwireOutputStream'
  // Streaming detailed event structure (exact event count/structure assertions)
  | 'streamingDetailedEvents'
  // Streaming suspend/resume with streamLegacy API
  | 'streamingSuspendResumeLegacy'
  // Auto-resume without specifying step parameter (single suspended step)
  | 'resumeAutoNoStep'
  // Resume with resumeSchema defaults (empty resumeData uses schema defaults)
  | 'resumeSchemaDefaults'
  // Consecutive parallel chains (.parallel().parallel())
  | 'consecutiveParallel'
  // Throw error when resuming a non-suspended workflow
  | 'resumeNotSuspendedWorkflow'
  // Throw error when resuming with invalid data (schema validation)
  | 'resumeInvalidData'
  // Agent options passthrough test
  | 'agentOptions'
  // Foreach suspend/resume with label
  | 'resumeForeachLabel'
  // Foreach suspend/resume with partial concurrency
  | 'resumeForeachPartial'
  // Foreach suspend/resume with partial concurrency and index
  | 'resumeForeachPartialIndex'
  // Branching - nested else/if-branch
  | 'branchingNestedConditions'
  // Foreach state batch and bail tests
  | 'foreachStateBatch'
  | 'foreachBail'
  // Error handling - logger and empty result tests
  | 'errorLogger'
  | 'errorEmptyResult'
  // Restart - nested workflows and suspend/resume after restart
  | 'restartNested'
  | 'restartSuspendResume'
  // DI - removed requestContext values in subsequent steps
  | 'diRemovedRequestContext'
  // DI - custom requestContext bug #4442
  | 'diBug4442'
  // DI - requestContext injection during resume
  | 'diResumeRequestContext'
  // DI - requestContext values set before suspension should persist after resume
  | 'diRequestContextBeforeSuspension'
  // Storage - resourceId preservation on resume
  | 'storageResourceIdResume'
  // Storage - shouldPersistSnapshot option
  | 'storageShouldPersistSnapshot'
  // Time travel to a non-existent step should fail
  | 'timeTravelNonExistentStep'
  // Resume a step that is not suspended (while another step IS suspended)
  | 'resumeNonSuspendedStep'
  // Foreach streaming progress events
  | 'foreachProgressStreaming'
  | 'foreachProgressConcurrentStreaming'
  | 'foreachProgressFailStreaming';

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
    Agent?: AgentClass;
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
   * Stream a workflow and return both events and result.
   * This is optional - only implement if the engine supports streaming.
   *
   * @param workflow - The workflow to stream
   * @param inputData - Input data for the workflow
   * @param options - Optional execution options
   * @param api - Which streaming API to use ('stream' or 'streamLegacy')
   */
  streamWorkflow?: <T>(
    workflow: Workflow<any, any, any, any, any, any, any>,
    inputData: T,
    options?: ExecuteWorkflowOptions,
    api?: 'stream' | 'streamLegacy',
  ) => Promise<StreamWorkflowResult>;

  /**
   * Resume a workflow via streaming and return both events and result.
   * This is optional - only implement if the engine supports streaming resume.
   *
   * @param workflow - The workflow to resume
   * @param options - Resume options (runId, step/label, resumeData)
   */
  streamResumeWorkflow?: (
    workflow: Workflow<any, any, any, any, any, any, any>,
    options: ResumeWorkflowOptions,
  ) => Promise<StreamWorkflowResult>;

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
  /** Close stream when workflow suspends (for streaming tests) */
  closeOnSuspend?: boolean;
  /** Output options (e.g., includeState to return state in result) */
  outputOptions?: {
    includeState?: boolean;
    includeResumeLabels?: boolean;
  };
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
  context?: Record<string, StepResult>;
  /** Optional run ID to use */
  runId?: string;
  /** Whether to run only one step (perStep mode) */
  perStep?: boolean;
  /** Input data for the step being time-traveled to (shorthand alternative to context) */
  inputData?: unknown;
  /** Nested steps context for nested workflows */
  nestedStepsContext?: Record<string, Record<string, StepResult>>;
  /** Resume data to pass to the step (for suspended workflow time travel) */
  resumeData?: unknown;
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

  /**
   * Agent class for creating agent steps (optional - for agent tests)
   */
  Agent?: AgentClass;
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
   * Stream a workflow and return both events and result.
   * Returns undefined if the engine doesn't support streaming.
   */
  stream?: <T>(
    workflow: Workflow<any, any, any, any, any, any, any>,
    inputData: T,
    options?: ExecuteWorkflowOptions,
    api?: 'stream' | 'streamLegacy',
  ) => Promise<StreamWorkflowResult>;

  /**
   * Resume a workflow via streaming and return both events and result.
   * Returns undefined if the engine doesn't support streaming resume.
   */
  streamResume?: (
    workflow: Workflow<any, any, any, any, any, any, any>,
    options: ResumeWorkflowOptions,
  ) => Promise<StreamWorkflowResult>;

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
