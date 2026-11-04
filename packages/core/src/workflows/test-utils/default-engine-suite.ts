import { createWorkflowTestSuite } from '@internal/workflow-test-utils';
import type {
  WorkflowResult,
  ResumeWorkflowOptions,
  TimeTravelWorkflowOptions,
  StreamWorkflowResult,
  StreamEvent,
  WorkflowTestConfig,
} from '@internal/workflow-test-utils';
import { vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import type { MockStore } from '../../storage/mock';
import { createTool } from '../../tools/tool';
import { createWorkflow } from '../create';
import { createStep } from '../workflow';
import type { Workflow } from '../workflow';

/**
 * Runs the shared workflow test suite on the default engine. Test files that call this must
 * unmock `crypto` and `node:crypto`, since these runs rely on real, unique run ids.
 */
export function createDefaultEngineTestSuite({
  name,
  storage,
  storageVersion,
  skipTests,
  afterEach,
}: {
  name: string;
  storage: InstanceType<typeof MockStore>;
  storageVersion?: 2;
  skipTests?: WorkflowTestConfig['skipTests'];
  afterEach?: () => Promise<void>;
}) {
  createWorkflowTestSuite({
    name,

    getWorkflowFactory: () => {
      return {
        createWorkflow: storageVersion
          ? (((params: any) =>
              createWorkflow({ ...params, options: { ...params.options, storageVersion } })) as typeof createWorkflow)
          : createWorkflow,
        createStep,
        createTool,
        Agent,
      };
    },

    // Register workflows with Mastra for storage/resume support
    registerWorkflows: async registry => {
      // Collect all workflows + any Mastra-level agents/tools the entries declare
      // (used by `.agent('id')` / `.tool('id')` by-id forms).
      const workflows: Record<string, any> = {};
      const agents: Record<string, any> = {};
      const tools: Record<string, any> = {};
      for (const [id, entry] of Object.entries(registry)) {
        workflows[id] = entry.workflow;
        if (entry.mastraAgents) Object.assign(agents, entry.mastraAgents);
        if (entry.mastraTools) Object.assign(tools, entry.mastraTools);
      }

      // Create Mastra with all workflows - this automatically binds mastra to each workflow
      new Mastra({
        logger: false,
        storage,
        workflows,
        agents: Object.keys(agents).length ? agents : undefined,
        tools: Object.keys(tools).length ? tools : undefined,
      });
    },

    getStorage: () => storage,

    afterAll: async () => {
      // Nothing to cleanup
    },

    afterEach,

    beforeEach: async () => {
      // These workflows share a single storage instance and rely on real, unique run
      // IDs so a previous test's snapshot can never be mistaken for the current run.
      // The shared test setup installs a deterministic `globalThis.crypto.randomUUID`
      // spy before every test, so undo it for this suite.
      vi.spyOn(globalThis.crypto, 'randomUUID').mockRestore();
      vi.clearAllMocks();
    },

    // ============================================================================
    // Domain-level skips
    // ============================================================================
    skip: {
      // All domains should work on Default Engine
      restart: false, // Default engine supports restart
    },

    // ============================================================================
    // Individual test skips
    // ============================================================================
    skipTests: {
      // Enable all tests - Default Engine is the reference implementation
      // Enable opt-in tests that require storage
      errorStorageRoundtrip: false,
      errorPersistWithoutStack: false,
      errorPersistMastraError: false,
      // This test rebuilds workflow instances to simulate server restart,
      // requiring direct Mastra registration which the shared suite can't do.
      // The test remains in workflow.test.ts as a default-engine-specific test.
      resumeMapBranchCondition: true,

      //default engine uses the same runId for parent and nested workflows which makes this test fail.
      //The test will be added in workflow.test.ts as a default-engine-specific test.
      restartNested: true,
      ...skipTests,
    },

    executeWorkflow: async (workflow, inputData, options = {}): Promise<WorkflowResult> => {
      const wf = workflow as Workflow<any, any, any, any, any, any, any>;

      const run = await wf.createRun({
        runId: options.runId,
        resourceId: options.resourceId,
      });

      // Use streaming API to ensure it works correctly - just await the result
      const streamResult = run.stream({
        inputData,
        initialState: options.initialState,
        perStep: options.perStep,
        requestContext: options.requestContext as any,
        outputOptions: options.outputOptions,
      });

      // Consume the stream to ensure it completes
      for await (const _event of streamResult.fullStream) {
        // Discard events - we only care about the result
      }

      const result = await streamResult.result;

      return result as WorkflowResult;
    },

    resumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<WorkflowResult> => {
      const wf = workflow as Workflow<any, any, any, any, any, any, any>;

      const run = await wf.createRun({ runId: options.runId });
      const result = await run.resume({
        step: options.step as any,
        label: options.label,
        resumeData: options.resumeData,
        forEachIndex: options.forEachIndex,
      });

      return result as WorkflowResult;
    },

    timetravelWorkflow: async (workflow, options: TimeTravelWorkflowOptions): Promise<WorkflowResult> => {
      const wf = workflow as Workflow<any, any, any, any, any, any, any>;

      const run = await wf.createRun({ runId: options.runId });
      const result = await run.timeTravel({
        step: options.step as any,
        context: options.context as any,
        perStep: options.perStep,
        inputData: options.inputData as any,
        nestedStepsContext: options.nestedStepsContext as any,
        resumeData: options.resumeData as any,
      });

      return result as WorkflowResult;
    },

    streamWorkflow: async (workflow, inputData, options = {}, api = 'stream'): Promise<StreamWorkflowResult> => {
      const wf = workflow as Workflow<any, any, any, any, any, any, any>;

      const run = await wf.createRun({
        runId: options.runId,
        resourceId: options.resourceId,
      });

      const events: StreamEvent[] = [];

      if (api === 'streamLegacy') {
        const { stream, getWorkflowState } = run.streamLegacy({
          inputData,
          initialState: options.initialState,
          perStep: options.perStep,
          requestContext: options.requestContext as any,
        });

        for await (const event of stream) {
          events.push(JSON.parse(JSON.stringify(event)));
        }

        const result = await getWorkflowState();
        return { events, result: result as WorkflowResult };
      } else {
        const streamResult = run.stream({
          inputData,
          initialState: options.initialState,
          perStep: options.perStep,
          requestContext: options.requestContext as any,
          closeOnSuspend: options.closeOnSuspend,
        });

        for await (const event of streamResult.fullStream) {
          events.push(JSON.parse(JSON.stringify(event)));
        }

        const result = await streamResult.result;
        return { events, result: result as WorkflowResult };
      }
    },

    streamResumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<StreamWorkflowResult> => {
      const wf = workflow as Workflow<any, any, any, any, any, any, any>;

      const run = await wf.createRun({ runId: options.runId });

      const events: StreamEvent[] = [];
      const streamResult = run.resumeStream({
        step: options.step as any,
        label: options.label,
        resumeData: options.resumeData,
        forEachIndex: options.forEachIndex,
      });

      for await (const event of streamResult.fullStream) {
        events.push(JSON.parse(JSON.stringify(event)));
      }

      const result = await streamResult.result;
      return { events, result: result as WorkflowResult };
    },
  });
}
