import { createWorkflowTestSuite } from '@internal/workflow-test-utils';
import type {
  WorkflowResult,
  ResumeWorkflowOptions,
  TimeTravelWorkflowOptions,
  StreamWorkflowResult,
  StreamEvent,
  WorkflowRegistry,
  WorkflowTestConfig,
} from '@internal/workflow-test-utils';
import { vi } from 'vitest';
import { Agent } from '../../agent';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import type { MockStore } from '../../storage/mock';
import { createTool } from '../../tools/tool';
import { createStep, createWorkflow } from '../evented';
import { withLoadedSteps } from './default-engine-suite';

/**
 * Runs the shared workflow test suite on the evented engine, with every workflow on
 * `storageVersion` when it's set.
 */
export function createEventedEngineTestSuite({
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
  // Long-lived Mastra instance with every test workflow registered + workers running.
  // Most tests use their own per-run Mastra (created in the helpers below), but a few
  // shared tests call `workflow.createRun()` directly and therefore need the workflow to
  // be bound to a Mastra whose event workers are running. After each test we re-bind all
  // registry workflows back to this instance (the per-test Mastras re-bind them to
  // short-lived, stopped instances).
  let registeredMastra: Mastra | undefined;
  let registeredRegistry: WorkflowRegistry | undefined;

  const rebindRegistryWorkflows = () => {
    if (!registeredMastra || !registeredRegistry) {
      return;
    }
    for (const entry of Object.values(registeredRegistry)) {
      (entry.workflow as any).__registerMastra?.(registeredMastra);
    }
  };

  // @ts-expect-error - TS2589: EventedWorkflow types cause excessively deep type instantiation
  createWorkflowTestSuite({
    name,

    getWorkflowFactory: () => ({
      createWorkflow: (storageVersion
        ? (params: any) => createWorkflow({ ...params, options: { ...params.options, storageVersion } })
        : createWorkflow) as any,
      createStep,
      createTool,
      Agent,
    }),

    skip: {
      // All domains should work on Evented Engine
      restart: false, // Evented engine supports restart
    },

    // Provide access to storage for tests that need to spy on storage operations
    getStorage: () => storage,

    // The evented processor deletes snapshot rows for non-paused terminal
    // statuses the workflow declined to persist (#22209).
    deletesDeclinedTerminalSnapshots: true,

    // Register every test workflow with a single long-lived Mastra (with its event
    // workers running) so tests that call `workflow.createRun()` directly work.
    registerWorkflows: async registry => {
      registeredRegistry = registry;
      const workflows: Record<string, any> = {};
      const agents: Record<string, any> = {};
      const tools: Record<string, any> = {};
      for (const [id, entry] of Object.entries(registry)) {
        workflows[id] = entry.workflow;
        if (entry.mastraAgents) Object.assign(agents, entry.mastraAgents);
        if (entry.mastraTools) Object.assign(tools, entry.mastraTools);
      }
      registeredMastra = new Mastra({
        logger: false,
        storage,
        workflows,
        agents: Object.keys(agents).length ? agents : undefined,
        tools: Object.keys(tools).length ? tools : undefined,
        pubsub: new EventEmitterPubSub(),
      });
      await registeredMastra.startWorkers();
    },

    beforeAll: async () => {
      vi.spyOn(globalThis.crypto, 'randomUUID').mockRestore();
    },

    afterAll: async () => {
      await registeredMastra?.stopWorkers();
    },

    beforeEach: async () => {
      // Don't reset mocks - they're created at describe time and need to persist
      const workflowsStore = await storage.getStore('workflows');
      await workflowsStore?.dangerouslyClearAll();
    },

    afterEach: async () => {
      // Per-test helpers create their own Mastra (which re-binds the workflow it runs to
      // that short-lived, now-stopped instance). Re-bind everything to the long-lived
      // Mastra so the next test still has a running engine if it uses createRun() directly.
      rebindRegistryWorkflows();
      await afterEach?.();
    },

    skipTests: {
      // Enable opt-in tests that require storage
      errorStorageRoundtrip: false,
      //persistWorkflowSnapshot error-handling tests are skipped because it's not used in evented-engine
      errorPersistWithoutStack: true,
      errorPersistMastraError: true,
      ...skipTests,
    },

    executeWorkflow: async (workflow, inputData, options = {}): Promise<WorkflowResult> => {
      // Create a fresh Mastra instance for each test execution
      // This ensures proper isolation between tests.
      // Carry through any mastraAgents/mastraTools declared for this workflow in the
      // shared harness registry so declarative `.agent('id')` / `.tool('id')` builder
      // calls can resolve their string references at execution time.
      const registryEntry = registeredRegistry?.[workflow.id];
      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        agents: registryEntry?.mastraAgents,
        tools: registryEntry?.mastraTools,
        storage,
        pubsub: new EventEmitterPubSub(),
      });

      try {
        // Start the event engine
        await mastra.startWorkers();

        // Create the run and execute using streaming API
        const run = await workflow.createRun({ runId: options.runId, resourceId: options.resourceId });
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

        return withLoadedSteps(result);
      } finally {
        // Always stop the event engine
        await mastra.stopWorkers();
      }
    },

    resumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<WorkflowResult> => {
      // Create a fresh Mastra instance with the same storage
      // This allows us to resume workflows from persisted state
      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        storage,
        pubsub: new EventEmitterPubSub(),
      });

      try {
        // Start the event engine
        await mastra.startWorkers();

        // Get the workflow run by ID
        const run = await workflow.createRun({ runId: options.runId });

        // Resume with the provided options
        const result = await run.resume({
          resumeData: options.resumeData,
          step: options.step,
          label: options.label,
          forEachIndex: options.forEachIndex,
        } as any);

        return withLoadedSteps(result);
      } finally {
        // Always stop the event engine
        await mastra.stopWorkers();
      }
    },

    timetravelWorkflow: async (workflow, options: TimeTravelWorkflowOptions): Promise<WorkflowResult> => {
      // Create a fresh Mastra instance with the same storage
      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        storage,
        pubsub: new EventEmitterPubSub(),
      });

      try {
        // Start the event engine
        await mastra.startWorkers();

        // Create a run and use timeTravel API
        const run = await workflow.createRun({ runId: options.runId });

        const result = await run.timeTravel({
          step: options.step as any,
          context: options.context as any,
          perStep: options.perStep,
          inputData: options.inputData as any,
          nestedStepsContext: options.nestedStepsContext as any,
          resumeData: options.resumeData as any,
        });

        return withLoadedSteps(result);
      } finally {
        // Always stop the event engine
        await mastra.stopWorkers();
      }
    },

    streamWorkflow: async (workflow, inputData, options = {}, api = 'stream'): Promise<StreamWorkflowResult> => {
      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        storage,
        pubsub: new EventEmitterPubSub(),
      });

      try {
        await mastra.startWorkers();

        const run = await workflow.createRun({
          runId: options.runId,
          resourceId: options.resourceId,
        });

        const events: StreamEvent[] = [];

        if (api === 'streamLegacy') {
          const { stream, getWorkflowState } = run.streamLegacy({
            inputData,
            initialState: options.initialState as any,
            perStep: options.perStep,
            requestContext: options.requestContext as any,
          } as any);

          for await (const event of stream) {
            events.push(JSON.parse(JSON.stringify(event)));
          }

          const result = await getWorkflowState();
          return { events, result: await withLoadedSteps(result) };
        }
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
        return { events, result: await withLoadedSteps(result) };
      } finally {
        await mastra.stopWorkers();
      }
    },

    streamResumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<StreamWorkflowResult> => {
      const mastra = new Mastra({
        workflows: { [workflow.id]: workflow },
        storage,
        pubsub: new EventEmitterPubSub(),
      });

      try {
        await mastra.startWorkers();

        const run = await workflow.createRun({ runId: options.runId });

        const events: StreamEvent[] = [];
        const streamResult = run.resumeStream({
          resumeData: options.resumeData,
          step: options.step,
          label: options.label,
        } as any);

        for await (const event of streamResult.fullStream) {
          events.push(JSON.parse(JSON.stringify(event)));
        }

        const result = await streamResult.result;
        return { events, result: await withLoadedSteps(result) };
      } finally {
        await mastra.stopWorkers();
      }
    },
  });
}
