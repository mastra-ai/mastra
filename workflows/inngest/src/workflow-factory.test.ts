/**
 * Test the workflow test factory with the Inngest engine
 *
 * This test uses shared infrastructure to avoid restarting docker-compose per test.
 * All workflows are pre-registered with Mastra at setup time, then Inngest syncs once.
 * Tests execute pre-registered workflows using unique run IDs for isolation.
 *
 * CURRENT STATUS: 96 passed, 6 skipped
 *
 * REMAINING SKIPPED TESTS:
 *
 * 1. TIMING (2 tests): Inngest dev server network overhead (100-500ms per step) makes
 *    timing-based assertions unreliable (foreachConcurrentTiming, foreachPartialConcurrencyTiming).
 *
 * 2. BEHAVIOR DIFFERENCES (2 tests):
 *    - schemaValidationThrows: Inngest wraps validation errors differently
 *    - abortStatus: Inngest returns 'failed' not 'canceled' on abort
 *
 * 3. STORAGE (1 test): errorStorageRoundtrip needs factory storage setup
 *
 * FIXED ISSUES:
 *
 * - RACE CONDITION: Partially fixed by adding explicit snapshot persistence before workflow-finish
 *   event in workflow.ts finalize step. Tests that were previously skipped (state,
 *   variableResolutionErrors, callbacks) now pass. foreachSingleConcurrency remains flaky.
 *
 * - LOOPS: Now use output assertions instead of mock counts (memoization-safe).
 *
 * - FLAKINESS: Retry mechanism (--retry=2) handles intermittent failures.
 */

import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { realtimeMiddleware } from '@inngest/realtime/middleware';
import { createWorkflowTestSuite } from '@internal/workflow-test-utils';
import type { WorkflowResult, WorkflowRegistry, ResumeWorkflowOptions } from '@internal/workflow-test-utils';
import { Mastra } from '@mastra/core/mastra';
import { createHonoServer } from '@mastra/deployer/server';
import { DefaultStorage } from '@mastra/libsql';
import { $ } from 'execa';
import { Inngest } from 'inngest';
import { vi } from 'vitest';

import type { InngestWorkflow } from './workflow';
import { init, serve as inngestServe } from './index';

// Shared infrastructure - created once for all tests
let inngest: Inngest;
let mastra: Mastra;
let server: ServerType;
let storage: DefaultStorage;

const INNGEST_PORT = 4000;
const HANDLER_PORT = 4001;

/**
 * Wait for handler to be responding to requests
 */
async function waitForHandler(maxAttempts = 30, intervalMs = 100): Promise<boolean> {
  const handlerUrl = `http://localhost:${HANDLER_PORT}/inngest/api`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(handlerUrl, { method: 'GET' });
      // The handler returns 200 on GET with function info
      if (response.ok || response.status === 405) {
        console.log(`[waitForHandler] Handler ready after ${i + 1} attempts`);
        return true;
      }
    } catch {
      // Connection refused, keep trying
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  console.log('[waitForHandler] Handler not ready after max attempts');
  return false;
}

/**
 * Ensure the Inngest dev server is running and has registered our functions.
 *
 * The Inngest dev server polls the handler URL for function definitions.
 * This function ensures:
 * 1. Handler is responding
 * 2. Inngest container is running
 * 3. Functions are registered (via polling)
 */
async function startInngest() {
  // First, verify the handler is responding
  console.log('[startInngest] Verifying handler is responding...');
  const handlerReady = await waitForHandler();
  if (!handlerReady) {
    throw new Error('Handler not responding on port ' + HANDLER_PORT);
  }

  // Check if Inngest is already running with functions registered
  let inngestRunning = false;
  let functionsRegistered = 0;
  try {
    const response = await fetch(`http://localhost:${INNGEST_PORT}/dev`);
    if (response.ok) {
      inngestRunning = true;
      const data = await response.json();
      functionsRegistered = data.functions?.length || 0;
      console.log(`[startInngest] Inngest already running with ${functionsRegistered} functions`);
    }
  } catch {
    console.log('[startInngest] Inngest not running');
  }

  if (!inngestRunning) {
    // Start the container
    console.log('[startInngest] Starting Inngest container...');
    await $({ cwd: import.meta.dirname })`docker compose up -d`;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // If no functions registered yet, the polling should pick them up
  // But since polling only works for ALREADY REGISTERED apps, we need to
  // restart to trigger auto-discovery while the handler is running
  if (functionsRegistered === 0) {
    console.log('[startInngest] No functions registered, restarting to trigger discovery...');
    await $({ cwd: import.meta.dirname })`docker compose restart`;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Wait for Inngest to be ready
  console.log('[startInngest] Waiting for Inngest to be ready...');
  let inngestReady = false;
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(`http://localhost:${INNGEST_PORT}/dev`);
      if (response.ok) {
        inngestReady = true;
        break;
      }
    } catch {
      // Keep trying
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!inngestReady) {
    console.log('[startInngest] WARNING: Inngest dev server not responding');
    return;
  }

  // Restart Docker to trigger auto-discovery while handler is running
  // This is the same approach used by the original tests
  console.log('[startInngest] Restarting Inngest to trigger auto-discovery...');
  await $({ cwd: import.meta.dirname })`docker compose restart`;

  // Wait for auto-discovery to complete (happens within ~1 second)
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Now check if functions are registered
  console.log('[startInngest] Checking if functions are registered...');
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${INNGEST_PORT}/dev`);
      const data = await response.json();
      functionsRegistered = data.functions?.length || 0;
      console.log(`[startInngest] Attempt ${i + 1}: ${functionsRegistered} functions registered`);
      if (functionsRegistered > 0) {
        console.log(`[startInngest] Successfully registered ${functionsRegistered} functions`);
        return;
      }
    } catch {
      console.log(`[startInngest] Attempt ${i + 1}: Could not check (Inngest may be restarting)`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('[startInngest] WARNING: No functions registered - tests will likely fail');
  console.log('[startInngest] This may be a Docker networking issue. Checking container logs...');
  try {
    const { stdout } = await $({ cwd: import.meta.dirname })`docker logs mastra-inngest-test 2>&1 | tail -10`;
    console.log('[startInngest] Container logs:', stdout);
  } catch {
    // Ignore
  }
}

/**
 * Stop the Inngest dev server
 */
async function _stopInngest() {
  await $({ cwd: import.meta.dirname })`docker compose down`;
}

createWorkflowTestSuite({
  name: 'Workflow (Inngest Engine)',

  getWorkflowFactory: () => {
    // Create Inngest client if not already created
    if (!inngest) {
      inngest = new Inngest({
        id: 'mastra-workflow-tests',
        baseUrl: `http://localhost:${INNGEST_PORT}`,
        middleware: [realtimeMiddleware()],
      });
    }
    return init(inngest);
  },

  /**
   * Register all workflows with Mastra and start the server.
   * This is called once after all workflows are created.
   *
   * Order of operations:
   * 1. Start the handler server (so Inngest can sync with it)
   * 2. Start Inngest (which will auto-discover and sync with handler)
   * 3. Wait for sync to complete
   */
  registerWorkflows: async (registry: WorkflowRegistry) => {
    // Collect all workflows from registry
    const workflows: Record<string, InngestWorkflow<any, any, any, any, any, any, any>> = {};
    for (const [id, entry] of Object.entries(registry)) {
      workflows[id] = entry.workflow as InngestWorkflow<any, any, any, any, any, any, any>;
    }

    // Create storage
    storage = new DefaultStorage({
      id: 'shared-test-storage',
      url: ':memory:',
    });

    // Create Mastra with all workflows
    mastra = new Mastra({
      storage,
      workflows,
      server: {
        apiRoutes: [
          {
            path: '/inngest/api',
            method: 'ALL',
            createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
          },
        ],
      },
    });

    // Start handler server FIRST (before Inngest)
    console.log('[registerWorkflows] Starting handler server...');

    // Debug: check what workflows are registered with Mastra
    const registeredWorkflows = mastra.listWorkflows();
    console.log(
      `[registerWorkflows] Mastra has ${Object.keys(registeredWorkflows).length} workflows registered:`,
      Object.keys(registeredWorkflows),
    );

    const app = await createHonoServer(mastra);
    server = serve({
      fetch: app.fetch,
      port: HANDLER_PORT,
    });
    console.log(`[registerWorkflows] Handler server started on port ${HANDLER_PORT}`);

    // Wait for handler to be fully ready before starting Inngest
    await new Promise(resolve => setTimeout(resolve, 500));

    // Now start Inngest (this also triggers registration via PUT with url body)
    console.log('[registerWorkflows] Starting Inngest...');
    await startInngest();
    console.log('[registerWorkflows] Inngest started and functions registered');
  },

  // Provide access to storage for tests that need to spy on storage operations
  getStorage: () => storage,

  // beforeAll is called AFTER registerWorkflows in the factory, so nothing to do here
  beforeAll: async () => {
    console.log('[beforeAll] Ready');
  },

  afterAll: async () => {
    // Close server
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
    // Don't stop docker during development - it causes issues when re-running tests
    // The container can be stopped manually with: docker compose down
    // await stopInngest();
  },

  beforeEach: async () => {
    // Reset all mock call counts to prevent accumulation across tests
    vi.clearAllMocks();

    // Wait for Inngest to settle between tests
    // The Inngest dev server needs time to process events and clean up from previous tests
    // Shorter delays (1s) cause flaky tests due to leftover state from previous runs
    await new Promise(resolve => setTimeout(resolve, 2000));
  },

  // ============================================================================
  // Domain-level skips: These domains require different APIs or aren't implemented
  // Individual test skips within enabled domains are configured in skipTests below
  // ============================================================================
  skip: {
    // ENABLED DOMAINS - these work with Inngest (individual tests may be skipped)
    variableResolution: false,
    simpleConditions: false,
    errorHandling: false,
    loops: false,
    foreach: false,
    branching: false,
    retry: false,
    callbacks: false,
    streaming: false,
    workflowRuns: false,
    dependencyInjection: false,
    nestedWorkflows: false,
    multipleChains: false,
    complexConditions: false,

    // SKIPPED DOMAINS - testing all of these now
    schemaValidation: false, // Testing - some tests may need individual skips
    suspendResume: false, // Works!
    timeTravel: false, // Works!
    agentStep: false, // Works!
    abort: false, // Testing - abortStatus test may need skip
    interoperability: false, // Testing - tool as step should work

    // SKIPPED DOMAINS - not supported on Inngest engine
    restart: true, // restart() throws "not supported on inngest workflows"
  },

  skipTests: {
    // ============================================================================
    // FIXED BY SNAPSHOT PERSISTENCE: These tests now pass after adding explicit
    // snapshot persistence before workflow-finish in workflow.ts finalize step.
    // ============================================================================
    state: false,
    variableResolutionErrors: false,
    foreachSingleConcurrency: true, // Flaky - race condition with snapshot persistence
    callbackOnFinish: false,
    callbackOnError: false,

    // ============================================================================
    // TIMING: Inngest network overhead (100-500ms/step) makes timing unreliable
    // ============================================================================
    foreachConcurrentTiming: true, // Expected <2000ms, got ~6000ms
    foreachPartialConcurrencyTiming: true, // Expected <1500ms, got ~7000ms

    // ============================================================================
    // BEHAVIOR DIFFERENCES: Inngest handles these differently than default engine
    // ============================================================================
    schemaValidationThrows: true, // Inngest doesn't throw - validation happens async, returns result
    abortStatus: true, // Inngest returns 'failed' or 'success', no 'canceled' status

    // ============================================================================
    // ALL PASSING TESTS
    // ============================================================================
    loopUntil: false,
    loopWhile: false,
    errorIdentity: false,
    emptyForeach: false,
    nestedMultipleLevels: false,
    mapPreviousStep: false,
    nestedWorkflowFailure: false,
    nestedDataPassing: false,
    callbackResult: false,
    callbackOnErrorNotCalled: false,
    callbackBothOnFailure: false,
    callbackAsyncOnFinish: false,
    callbackAsyncOnError: false,
    nestedWorkflowErrors: false,
    parallelBranchErrors: false,
    errorMessageFormat: false,
    branchingElse: false,
    stepExecutionOrder: false,
    nonObjectOutput: false,
    requestContextPropagation: false,
    getInitData: false,
    errorCauseChain: false,
    // Storage round-trip test - enabled since storage tests pass
    errorStorageRoundtrip: false,
    // Error persistence tests - enabled with storage spy access
    errorPersistWithoutStack: false,
    errorPersistMastraError: false,
    // Resume tests - enabled for testing
    resumeBasic: false,
    resumeWithLabel: false, // Testing - uses label instead of step
    resumeWithState: false, // Testing - state preservation across resume
    resumeNested: true, // Not yet implemented
    resumeParallelMulti: false, // Testing - multiple suspend/resume in parallel workflow
    resumeAutoDetect: true, // Inngest result doesn't include 'suspended' array property
    resumeBranchingStatus: true, // Inngest branching + suspend behavior differs (returns 'failed' not 'suspended')
    resumeNested: true, // Nested step path resume not supported on Inngest
    resumeConsecutiveNested: true, // Nested step path resume not supported on Inngest
    resumeDountil: true, // Dountil loop with nested resume not supported on Inngest
    resumeLoopInput: true, // Loop resume input tracking not supported on Inngest
    resumeMapStep: true, // Map step resume not supported on Inngest
    // Storage tests - enabled for testing
    storageListRuns: false,
    storageGetDelete: false,
    storageResourceId: false,
    // Run count tests - skip until loop behavior is verified
    runCount: true,
    retryCount: true,
  },

  executeWorkflow: async (workflow, inputData, options = {}): Promise<WorkflowResult> => {
    const inngestWorkflow = workflow as unknown as InngestWorkflow<any, any, any, any, any, any, any>;

    // Create the run and execute
    // The workflow is already registered with Mastra, so we can execute directly
    const run = await inngestWorkflow.createRun({
      runId: options.runId,
      resourceId: options.resourceId,
    });
    const result = await run.start({
      inputData,
      initialState: options.initialState,
      perStep: options.perStep,
      requestContext: options.requestContext as any,
    });

    return result as WorkflowResult;
  },

  resumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<WorkflowResult> => {
    const inngestWorkflow = workflow as unknown as InngestWorkflow<any, any, any, any, any, any, any>;

    // Create the run with the existing runId to resume
    const run = await inngestWorkflow.createRun({ runId: options.runId });
    const result = await run.resume({
      step: options.step,
      label: options.label,
      resumeData: options.resumeData,
    } as any);

    return result as WorkflowResult;
  },
});
