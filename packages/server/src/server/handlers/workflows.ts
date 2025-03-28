import { ReadableStream } from 'node:stream/web';
import type { Mastra } from '@mastra/core';
import type { Workflow } from '@mastra/core/workflows';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';
import { HTTPException } from '../http-exception';

import { handleError } from './error';

interface WorkflowContext {
  mastra: Mastra;
  workflowId?: string;
  runId?: string;
}

export async function getWorkflowsHandler({ mastra }: WorkflowContext) {
  try {
    const workflows = mastra.getWorkflows({ serialized: false });
    const _workflows = Object.entries(workflows).reduce<any>((acc, [key, workflow]) => {
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
            ..._step,
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
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error getting workflows' });
  }
}

export async function getWorkflowByIdHandler({ mastra, workflowId }: WorkflowContext) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.getWorkflow(workflowId);

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
          ..._step,
          inputSchema: _step.inputSchema ? stringify(zodToJsonSchema(_step.inputSchema)) : undefined,
          outputSchema: _step.outputSchema ? stringify(zodToJsonSchema(_step.outputSchema)) : undefined,
        };
        return acc;
      }, {}),
    };
  } catch (error) {
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error getting workflow' });
  }
}

export async function startAsyncWorkflowHandler({
  mastra,
  workflowId,
  runId,
  triggerData,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & { triggerData?: unknown }) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.getWorkflow(workflowId);

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to start run' });
    }

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const result = await run.start({
      triggerData,
    });
    return result;
  } catch (error) {
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error executing workflow' });
  }
}

export async function getWorkflowRunHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>): Promise<ReturnType<Workflow['getRun']>> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'Run ID is required' });
    }

    const workflow = mastra.getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    return run;
  } catch (error) {
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error getting workflow run' });
  }
}

export async function createRunHandler({
  mastra,
  workflowId,
  runId: prevRunId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const { runId } = workflow.createRun({ runId: prevRunId });

    return { runId };
  } catch (error) {
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error creating workflow run' });
  }
}

export async function startWorkflowRunHandler({
  mastra,
  workflowId,
  runId,
  triggerData,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & { triggerData?: unknown }) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to start run' });
    }

    const workflow = mastra.getWorkflow(workflowId);
    const run = workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    await run.start({
      triggerData,
    });

    return { message: 'Workflow run started' };
  } catch (e) {
    return handleError(e, 'Error starting workflow run');
  }
}

export async function watchWorkflowHandler({
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

    const workflow = mastra.getWorkflow(workflowId);
    const run = workflow.getRun(runId);

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

          // a run is finished if we cannot retrieve it anymore
          asyncRef = setImmediate(() => {
            if (!workflow.getRun(runId)) {
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

export async function resumeAsyncWorkflowHandler({
  mastra,
  workflowId,
  runId,
  body,
}: WorkflowContext & { body: { stepId: string; context: any } }) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const workflow = mastra.getWorkflow(workflowId);
    const run = workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const result = await run.resume({
      stepId: body.stepId,
      context: body.context,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error resuming workflow step');
  }
}

export async function resumeWorkflowHandler({
  mastra,
  workflowId,
  runId,
  body,
}: WorkflowContext & { body: { stepId: string; context: any } }) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const workflow = mastra.getWorkflow(workflowId);
    const run = workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    await run.resume({
      stepId: body.stepId,
      context: body.context,
    });

    return { message: 'Workflow run resumed' };
  } catch (error) {
    return handleError(error, 'Error resuming workflow');
  }
}
