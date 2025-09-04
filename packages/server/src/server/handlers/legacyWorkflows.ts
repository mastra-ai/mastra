import { ReadableStream } from 'node:stream/web';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { LegacyWorkflowRuns } from '@mastra/core/storage';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import type { LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { stringify } from 'superjson';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { handleError } from './error';

interface WorkflowContext extends Context {
  workflowId?: string;
  runId?: string;
}

export async function getLegacyWorkflowsHandler({ mastra }: WorkflowContext) {
  try {
    const workflows = mastra.legacy_getWorkflows({ serialized: false });
    const _workflows = Object.entries(workflows).reduce<any>((acc, [key, workflow]) => {
      if (workflow.isNested) return acc;
      acc[key] = {
        stepGraph: workflow.stepGraph,
        stepSubscriberGraph: workflow.stepSubscriberGraph,
        serializedStepGraph: workflow.serializedStepGraph,
        serializedStepSubscriberGraph: workflow.serializedStepSubscriberGraph,
        name: workflow.name,
        triggerSchema: workflow.triggerSchema ? stringify(zodToJsonSchema(workflow.triggerSchema)) : undefined,
        steps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
          const _step = step as any;
          acc[key] = {
            id: _step.id,
            description: _step.description,
            workflowId: _step.workflowId,
            inputSchema: _step.inputSchema ? stringify(zodToJsonSchema(_step.inputSchema)) : undefined,
            outputSchema: _step.outputSchema ? stringify(zodToJsonSchema(_step.outputSchema)) : undefined,
          };
          return acc;
        }, {}),
      };
      return acc;
    }, {});
    return _workflows;
  } catch (error) {
    return handleError(error, 'error getting workflows');
  }
}

export async function getLegacyWorkflowByIdHandler({ mastra, workflowId }: WorkflowContext) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.legacy_getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    return {
      stepGraph: workflow.stepGraph,
      stepSubscriberGraph: workflow.stepSubscriberGraph,
      serializedStepGraph: workflow.serializedStepGraph,
      serializedStepSubscriberGraph: workflow.serializedStepSubscriberGraph,
      name: workflow.name,
      triggerSchema: workflow.triggerSchema ? stringify(zodToJsonSchema(workflow.triggerSchema)) : undefined,
      steps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
        const _step = step as any;
        acc[key] = {
          id: _step.id,
          description: _step.description,
          workflowId: _step.workflowId,
          inputSchema: _step.inputSchema ? stringify(zodToJsonSchema(_step.inputSchema)) : undefined,
          outputSchema: _step.outputSchema ? stringify(zodToJsonSchema(_step.outputSchema)) : undefined,
        };
        return acc;
      }, {}),
    };
  } catch (error) {
    return handleError(error, 'error getting workflow by id');
  }
}

export async function startAsyncLegacyWorkflowHandler({
  mastra,
  runtimeContext,
  workflowId,
  runId,
  triggerData,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  triggerData?: unknown;
  runtimeContext: RuntimeContext;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.legacy_getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    if (!runId) {
      const newRun = workflow.createRun();
      const result = await newRun.start({
        triggerData,
        runtimeContext,
      });
      return result;
    }

    const run = workflow.getMemoryRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    // const newRun = workflow.createRun({ runId });

    const result = await run.start({
      triggerData,
      runtimeContext,
    });
    return result;
  } catch (error) {
    return handleError(error, 'error starting workflow');
  }
}

export async function getLegacyWorkflowRunHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>): Promise<ReturnType<LegacyWorkflow['getRun']>> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'Run ID is required' });
    }

    const workflow = mastra.legacy_getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    return run;
  } catch (error) {
    return handleError(error, 'error getting workflow run');
  }
}

export async function createLegacyWorkflowRunHandler({
  mastra,
  workflowId,
  runId: prevRunId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.legacy_getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const newRun = workflow.createRun({ runId: prevRunId });

    return { runId: newRun.runId };
  } catch (error) {
    return handleError(error, 'error creating workflow run');
  }
}

export async function startLegacyWorkflowRunHandler({
  mastra,
  runtimeContext,
  workflowId,
  runId,
  triggerData,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  triggerData?: unknown;
  runtimeContext: RuntimeContext;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to start run' });
    }

    const workflow = mastra.legacy_getWorkflow(workflowId);
    const run = workflow.getMemoryRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    void run.start({
      triggerData,
      runtimeContext,
    });

    return { message: 'Workflow run started' };
  } catch (e) {
    return handleError(e, 'Error starting workflow run');
  }
}

export async function watchLegacyWorkflowHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>): Promise<ReadableStream<string>> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to watch workflow' });
    }

    const workflow = mastra.legacy_getWorkflow(workflowId);
    const run = workflow.getMemoryRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    let unwatch: () => void;
    let asyncRef: NodeJS.Immediate | null = null;
    const stream = new ReadableStream<string>({
      start(controller) {
        unwatch = run.watch(({ activePaths, runId, timestamp, results }) => {
          const activePathsObj = Object.fromEntries(activePaths);
          controller.enqueue(JSON.stringify({ activePaths: activePathsObj, runId, timestamp, results }));

          if (asyncRef) {
            clearImmediate(asyncRef);
            asyncRef = null;
          }

          // a run is finished if none of the active paths is currently being executed
          asyncRef = setImmediate(() => {
            const runDone = Object.values(activePathsObj).every(value => value.status !== 'executing');
            if (runDone) {
              controller.close();
              unwatch?.();
            }
          });
        });
      },
      cancel() {
        unwatch?.();
      },
    });

    return stream;
  } catch (error) {
    return handleError(error, 'Error watching workflow');
  }
}

export async function resumeAsyncLegacyWorkflowHandler({
  mastra,
  workflowId,
  runId,
  body,
  runtimeContext,
}: WorkflowContext & { body: { stepId: string; context: any }; runtimeContext: RuntimeContext }) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const workflow = mastra.legacy_getWorkflow(workflowId);
    const run = workflow.getMemoryRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    // const newRun = workflow.createRun({ runId });

    const result = await run.resume({
      stepId: body.stepId,
      context: body.context,
      runtimeContext,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error resuming workflow step');
  }
}

export async function resumeLegacyWorkflowHandler({
  mastra,
  workflowId,
  runId,
  body,
  runtimeContext,
}: WorkflowContext & { body: { stepId: string; context: any }; runtimeContext: RuntimeContext }) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const workflow = mastra.legacy_getWorkflow(workflowId);
    const run = workflow.getMemoryRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    void run.resume({
      stepId: body.stepId,
      context: body.context,
      runtimeContext,
    });

    return { message: 'Workflow run resumed' };
  } catch (error) {
    return handleError(error, 'Error resuming workflow');
  }
}

export async function getLegacyWorkflowRunsHandler({
  mastra,
  workflowId,
  fromDate,
  toDate,
  limit,
  offset,
  resourceId,
}: WorkflowContext & {
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
  resourceId?: string;
}): Promise<LegacyWorkflowRuns> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.legacy_getWorkflow(workflowId);
    const workflowRuns = (await workflow.getWorkflowRuns({ fromDate, toDate, limit, offset, resourceId })) || {
      runs: [],
      total: 0,
    };
    return workflowRuns;
  } catch (error) {
    return handleError(error, 'Error getting workflow runs');
  }
}
