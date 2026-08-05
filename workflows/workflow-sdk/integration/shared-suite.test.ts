import type {
  ExecuteWorkflowOptions,
  ResumeWorkflowOptions,
  StreamEvent,
  StreamWorkflowResult,
  TimeTravelWorkflowOptions,
  WorkflowResult,
} from '@internal/workflow-test-utils';
import { createWorkflowTestSuite } from '@internal/workflow-test-utils';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { MockStore } from '@mastra/core/storage';
import { init } from '../src/index';
import type { WorkflowSdkWorkflow } from '../src/workflow';
import { mastraRunner } from '../src/workflows/index';

/**
 * Shared workflow test suite run against the Workflow SDK engine.
 *
 * Workflows are created at test collection time by the suite factory; committing
 * them auto-registers each one in the global registry, which the bundled
 * dispatcher reads from (the `@workflow/vitest` local world executes the
 * combined bundle in this same process, so the `globalThis` registry is shared).
 *
 * The skip lists below are the living gap scoreboard for
 * `.context/workflow-sdk-engine-gaps.md`. Skips fall into two buckets:
 * - DEFERRED: features intentionally out of scope (streamLegacy) — see the
 *   gaps doc.
 * - GAP: features the engine should support but does not yet; each is tied to
 *   a phase of the bridging plan and should flip to `false` as phases land.
 */
const { createWorkflow, createStep, createTool } = init({ runner: mastraRunner });

const sharedStorage = new MockStore();
let _mastra: Mastra | undefined;

type AnySdkWorkflow = WorkflowSdkWorkflow<any, any, any, any, any, any, any>;

createWorkflowTestSuite({
  name: 'Workflow (Workflow SDK Engine)',

  getWorkflowFactory: () => {
    return {
      createWorkflow: createWorkflow as any,
      createStep: createStep as any,
      createTool: createTool as any,
      Agent,
    };
  },

  registerWorkflows: async registry => {
    // Collect all workflows + any Mastra-level agents/tools the entries declare
    // (used by `.agent('id')` / `.tool('id')` by-id forms).
    const workflows: Record<string, any> = {};
    const agents: Record<string, any> = {};
    const tools: Record<string, any> = {};
    for (const [id, entry] of Object.entries(registry)) {
      workflows[id] = entry.workflow;
      for (const [agentId, agent] of Object.entries(entry.mastraAgents ?? {})) {
        if (agentId in agents && agents[agentId] !== agent) {
          throw new Error(`registerWorkflows: agent id collision across registry entries: "${agentId}"`);
        }
        agents[agentId] = agent;
      }
      for (const [toolId, tool] of Object.entries(entry.mastraTools ?? {})) {
        if (toolId in tools && tools[toolId] !== tool) {
          throw new Error(`registerWorkflows: tool id collision across registry entries: "${toolId}"`);
        }
        tools[toolId] = tool;
      }
    }
    // Binds mastra (and thus storage) to every workflow, which re-registers the
    // registry facades with the mastra instance the dispatcher needs for
    // snapshot persistence and resume.
    _mastra = new Mastra({
      logger: false,
      storage: sharedStorage,
      workflows,
      agents: Object.keys(agents).length ? agents : undefined,
      tools: Object.keys(tools).length ? tools : undefined,
    });
  },

  getStorage: () => sharedStorage,

  skip: {},

  skipTests: {
    // DEFERRED — streamLegacy() is not supported on this engine.
    streamingSuspendResumeLegacy: true,
    streamingLegacyEvents: true,
    streamingDetailedEvents: true,

    // HARNESS LIMITATION — this test rebuilds workflow instances to simulate a
    // server restart, requiring direct Mastra registration which the shared
    // suite can't do. The default engine skips it here for the same reason.
    // The engine-specific copy lives in `map-branch-resume.test.ts`.
    resumeMapBranchCondition: true,
  },

  executeWorkflow: async (workflow, inputData, options: ExecuteWorkflowOptions = {}): Promise<WorkflowResult> => {
    const wf = workflow as unknown as AnySdkWorkflow;
    const run = await wf.createRun({ runId: options.runId, resourceId: options.resourceId });
    const result = await run.start({
      inputData,
      initialState: options.initialState,
      requestContext: options.requestContext as any,
      outputOptions: options.outputOptions,
      perStep: options.perStep,
    });
    return result as WorkflowResult;
  },

  resumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<WorkflowResult> => {
    const wf = workflow as unknown as AnySdkWorkflow;
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
    const wf = workflow as unknown as AnySdkWorkflow;
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

  streamWorkflow: async (
    workflow,
    inputData,
    options: ExecuteWorkflowOptions = {},
    api: 'stream' | 'streamLegacy' = 'stream',
  ): Promise<StreamWorkflowResult> => {
    if (api === 'streamLegacy') {
      throw new Error('streamLegacy() is not supported on the Workflow SDK engine');
    }
    const wf = workflow as unknown as AnySdkWorkflow;
    const run = await wf.createRun({ runId: options.runId, resourceId: options.resourceId });
    const output = run.stream({
      inputData,
      initialState: options.initialState,
      requestContext: options.requestContext as any,
      outputOptions: options.outputOptions,
    });

    const events: StreamEvent[] = [];
    for await (const event of output.fullStream) {
      events.push(event as unknown as StreamEvent);
    }
    const result = await output.result;
    return { events, result: result as WorkflowResult };
  },

  streamResumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<StreamWorkflowResult> => {
    const wf = workflow as unknown as AnySdkWorkflow;
    const run = await wf.createRun({ runId: options.runId });

    // The engine has no dedicated streaming-resume API yet; observe the run's
    // event stream while the resume settles.
    const events: StreamEvent[] = [];
    const unwatch = run.watch(event => {
      events.push(event as unknown as StreamEvent);
    });
    try {
      const result = await run.resume({
        step: options.step as any,
        label: options.label,
        resumeData: options.resumeData,
        forEachIndex: options.forEachIndex,
      });
      return { events, result: result as WorkflowResult };
    } finally {
      unwatch();
    }
  },
});
