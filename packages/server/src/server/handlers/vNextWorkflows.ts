import { ReadableStream } from 'node:stream/web';
import type { RuntimeContext } from '@mastra/core/di';
import type { WorkflowRuns } from '@mastra/core/storage';
import type { NewWorkflow } from '@mastra/core/workflows/vNext';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { handleError } from './error';

interface VNextWorkflowContext extends Context {
  workflowId?: string;
  runId?: string;
}

export async function getVNextWorkflowsHandler({ mastra }: VNextWorkflowContext) {
  try {
    const workflows = mastra.vnext_getWorkflows({ serialized: false });
    const _workflows = Object.entries(workflows).reduce<any>((acc, [key, workflow]) => {
      acc[key] = {
        name: workflow.name,
        steps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
          acc[key] = {
            ...step,
            inputSchema: step.inputSchema ? stringify(zodToJsonSchema(step.inputSchema)) : undefined,
            outputSchema: step.outputSchema ? stringify(zodToJsonSchema(step.outputSchema)) : undefined,
          };
          return acc;
        }, {}),
        stepGraph: workflow.stepGraph,
        inputSchema: workflow.inputSchema ? stringify(zodToJsonSchema(workflow.inputSchema)) : undefined,
        outputSchema: workflow.outputSchema ? stringify(zodToJsonSchema(workflow.outputSchema)) : undefined,
      };
      return acc;
    }, {});
    return _workflows;
  } catch (error) {
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error getting workflows' });
  }
}

export async function getVNextWorkflowByIdHandler({ mastra, workflowId }: VNextWorkflowContext) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    return {
      steps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
        acc[key] = {
          ...step,
          inputSchema: step.inputSchema ? stringify(zodToJsonSchema(step.inputSchema)) : undefined,
          outputSchema: step.outputSchema ? stringify(zodToJsonSchema(step.outputSchema)) : undefined,
        };
        return acc;
      }, {}),
      name: workflow.name,
      stepGraph: workflow.stepGraph,
      inputSchema: workflow.inputSchema ? stringify(zodToJsonSchema(workflow.inputSchema)) : undefined,
      outputSchema: workflow.outputSchema ? stringify(zodToJsonSchema(workflow.outputSchema)) : undefined,
    };
  } catch (error) {
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error getting workflow' });
  }
}

export async function getVNextWorkflowRunHandler({
  mastra,
  workflowId,
  runId,
}: Pick<VNextWorkflowContext, 'mastra' | 'workflowId' | 'runId'>): Promise<ReturnType<NewWorkflow['getWorkflowRun']>> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'Run ID is required' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.getWorkflowRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    return run;
  } catch (error) {
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error getting workflow run' });
  }
}

export async function createVNextWorkflowRunHandler({
  mastra,
  workflowId,
  runId: prevRunId,
}: Pick<VNextWorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = workflow.createRun({ runId: prevRunId });

    return { runId: run.runId };
  } catch (error) {
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error creating workflow run' });
  }
}

export async function startAsyncVNextWorkflowHandler({
  mastra,
  runtimeContext,
  workflowId,
  runId,
  inputData,
}: Pick<VNextWorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  runtimeContext?: RuntimeContext;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const _run = workflow.createRun({ runId });
    const result = await _run.start({
      inputData,
      runtimeContext,
    });
    return result;
  } catch (error) {
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error executing workflow' });
  }
}

export async function startVNextWorkflowRunHandler({
  mastra,
  runtimeContext,
  workflowId,
  runId,
  inputData,
}: Pick<VNextWorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  runtimeContext?: RuntimeContext;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to start run' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);
    const run = await workflow.getWorkflowRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = workflow.createRun({ runId });
    await _run.start({
      inputData,
      runtimeContext,
    });

    return { message: 'Workflow run started' };
  } catch (e) {
    return handleError(e, 'Error starting workflow run');
  }
}

export async function watchVNextWorkflowHandler({
  mastra,
  workflowId,
  runId,
}: Pick<VNextWorkflowContext, 'mastra' | 'workflowId' | 'runId'>): Promise<ReadableStream<string>> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to watch workflow' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);
    const run = await workflow.getWorkflowRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = workflow.createRun({ runId });
    let unwatch: () => void;
    let asyncRef: NodeJS.Immediate | null = null;
    const stream = new ReadableStream<string>({
      start(controller) {
        unwatch = _run.watch(({ type, payload, eventTimestamp }) => {
          controller.enqueue(JSON.stringify({ type, payload, eventTimestamp, runId }));

          if (asyncRef) {
            clearImmediate(asyncRef);
            asyncRef = null;
          }

          // a run is finished if we cannot retrieve it anymore
          asyncRef = setImmediate(async () => {
            const runDone = payload.workflowState.status !== 'running';
            if (runDone) {
              controller.close();
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

export async function resumeAsyncVNextWorkflowHandler({
  mastra,
  workflowId,
  runId,
  body,
  runtimeContext,
}: VNextWorkflowContext & {
  body: { step: string | string[]; resumeData?: unknown };
  runtimeContext?: RuntimeContext;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    if (!body.step) {
      throw new HTTPException(400, { message: 'step required to resume workflow' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);
    const run = await workflow.getWorkflowRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = workflow.createRun({ runId });

    const result = await _run.resume({
      step: body.step,
      resumeData: body.resumeData,
      runtimeContext,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error resuming workflow step');
  }
}

export async function resumeVNextWorkflowHandler({
  mastra,
  workflowId,
  runId,
  body,
  runtimeContext,
}: VNextWorkflowContext & {
  body: { step: string | string[]; resumeData?: unknown };
  runtimeContext?: RuntimeContext;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    if (!body.step) {
      throw new HTTPException(400, { message: 'step required to resume workflow' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);
    const run = await workflow.getWorkflowRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = workflow.createRun({ runId });

    await _run.resume({
      step: body.step,
      resumeData: body.resumeData,
      runtimeContext,
    });

    return { message: 'Workflow run resumed' };
  } catch (error) {
    return handleError(error, 'Error resuming workflow');
  }
}

export async function getVNextWorkflowRunsHandler({ mastra, workflowId }: VNextWorkflowContext): Promise<WorkflowRuns> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);
    const workflowRuns = (await workflow.getWorkflowRuns()) || {
      runs: [],
      total: 0,
    };
    return workflowRuns;
  } catch (error) {
    return handleError(error, 'Error getting workflow runs');
  }
}
