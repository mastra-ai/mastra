import { ReadableStream } from 'node:stream/web';
import { RuntimeContext } from '@mastra/core/di';
import type { WorkflowRuns } from '@mastra/core/storage';
import type { NewWorkflow, SerializedStepFlowEntry } from '@mastra/core/workflows/vNext';
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
            id: step.id,
            description: step.description,
            inputSchema: step.inputSchema ? stringify(zodToJsonSchema(step.inputSchema)) : undefined,
            outputSchema: step.outputSchema ? stringify(zodToJsonSchema(step.outputSchema)) : undefined,
            resumeSchema: step.resumeSchema ? stringify(zodToJsonSchema(step.resumeSchema)) : undefined,
            suspendSchema: step.suspendSchema ? stringify(zodToJsonSchema(step.suspendSchema)) : undefined,
          };
          return acc;
        }, {}),
        stepGraph: workflow.serializedStepGraph,
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

type SerializedStep = {
  id: string;
  description: string;
  inputSchema: string | undefined;
  outputSchema: string | undefined;
  resumeSchema: string | undefined;
  suspendSchema: string | undefined;
};

export async function getVNextWorkflowByIdHandler({ mastra, workflowId }: VNextWorkflowContext): Promise<{
  steps: SerializedStep[];
  name: string | undefined;
  stepGraph: SerializedStepFlowEntry[];
  inputSchema: string | undefined;
  outputSchema: string | undefined;
}> {
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
          id: step.id,
          description: step.description,
          inputSchema: step.inputSchema ? stringify(zodToJsonSchema(step.inputSchema)) : undefined,
          outputSchema: step.outputSchema ? stringify(zodToJsonSchema(step.outputSchema)) : undefined,
          resumeSchema: step.resumeSchema ? stringify(zodToJsonSchema(step.resumeSchema)) : undefined,
          suspendSchema: step.suspendSchema ? stringify(zodToJsonSchema(step.suspendSchema)) : undefined,
        };
        return acc;
      }, {}),
      name: workflow.name,
      stepGraph: workflow.serializedStepGraph,
      // @ts-ignore - ignore infinite recursion
      inputSchema: workflow.inputSchema ? stringify(zodToJsonSchema(workflow.inputSchema)) : undefined,
      // @ts-ignore - ignore infinite recursion
      outputSchema: workflow.outputSchema ? stringify(zodToJsonSchema(workflow.outputSchema)) : undefined,
    };
  } catch (error) {
    throw new HTTPException(500, { message: (error as Error)?.message || 'Error getting workflow' });
  }
}

export async function getVNextWorkflowRunByIdHandler({
  mastra,
  workflowId,
  runId,
}: Pick<VNextWorkflowContext, 'mastra' | 'workflowId' | 'runId'>): Promise<
  ReturnType<NewWorkflow['getWorkflowRunById']>
> {
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

    const run = await workflow.getWorkflowRunById(runId);

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
  runtimeContextFromRequest,
}: Pick<VNextWorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  runtimeContext?: RuntimeContext;
  runtimeContextFromRequest?: Record<string, unknown>;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext?.entries() ?? []),
      ...Array.from(Object.entries(runtimeContextFromRequest ?? {})),
    ]);

    const _run = workflow.createRun({ runId });
    const result = await _run.start({
      inputData,
      runtimeContext: finalRuntimeContext,
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
  runtimeContextFromRequest,
}: Pick<VNextWorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  runtimeContext?: RuntimeContext;
  runtimeContextFromRequest?: Record<string, unknown>;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to start run' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);
    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext?.entries() ?? []),
      ...Array.from(Object.entries(runtimeContextFromRequest ?? {})),
    ]);

    const _run = workflow.createRun({ runId });
    void _run.start({
      inputData,
      runtimeContext: finalRuntimeContext,
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
    const run = await workflow.getWorkflowRunById(runId);

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

          // a run is finished if the status is not running
          asyncRef = setImmediate(async () => {
            const runDone = payload.workflowState.status !== 'running';
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

export async function resumeAsyncVNextWorkflowHandler({
  mastra,
  workflowId,
  runId,
  body,
  runtimeContext,
  runtimeContextFromRequest,
}: VNextWorkflowContext & {
  body: { step: string | string[]; resumeData?: unknown };
  runtimeContext?: RuntimeContext;
  runtimeContextFromRequest?: Record<string, unknown>;
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
    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const finalRuntimeContext = new RuntimeContext<Record<string, unknown>>([
      ...Array.from(runtimeContext?.entries() ?? []),
      ...Array.from(Object.entries(runtimeContextFromRequest ?? {})),
    ]);

    const _run = workflow.createRun({ runId });
    const result = await _run.resume({
      step: body.step,
      resumeData: body.resumeData,
      runtimeContext: finalRuntimeContext,
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
    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = workflow.createRun({ runId });

    void _run.resume({
      step: body.step,
      resumeData: body.resumeData,
      runtimeContext,
    });

    return { message: 'Workflow run resumed' };
  } catch (error) {
    return handleError(error, 'Error resuming workflow');
  }
}

export async function getVNextWorkflowRunsHandler({
  mastra,
  workflowId,
  fromDate,
  toDate,
  limit,
  offset,
  resourceId,
}: VNextWorkflowContext & {
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
  resourceId?: string;
}): Promise<WorkflowRuns> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const workflow = mastra.vnext_getWorkflow(workflowId);
    const workflowRuns = (await workflow.getWorkflowRuns({ fromDate, toDate, limit, offset, resourceId })) || {
      runs: [],
      total: 0,
    };
    return workflowRuns;
  } catch (error) {
    return handleError(error, 'Error getting workflow runs');
  }
}
