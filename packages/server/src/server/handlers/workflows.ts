import { ReadableStream, TransformStream } from 'node:stream/web';
import type { RuntimeContext } from '@mastra/core/di';
import type { WorkflowRuns } from '@mastra/core/storage';
import type { Workflow, WatchEvent, WorkflowInfo, StreamEvent } from '@mastra/core/workflows';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { getWorkflowInfo, WorkflowRegistry } from '../utils';
import { handleError } from './error';

export interface WorkflowContext extends Context {
  workflowId?: string;
  runId?: string;
}

export async function getWorkflowsHandler({ mastra }: WorkflowContext) {
  try {
    const workflows = mastra.getWorkflows({ serialized: false });
    const _workflows = Object.entries(workflows).reduce<Record<string, WorkflowInfo>>((acc, [key, workflow]) => {
      acc[key] = getWorkflowInfo(workflow);
      return acc;
    }, {});
    return _workflows;
  } catch (error) {
    return handleError(error, 'Error getting workflows');
  }
}

async function getWorkflowsFromSystem({ mastra, workflowId }: WorkflowContext) {
  const logger = mastra.getLogger();

  if (!workflowId) {
    throw new HTTPException(400, { message: 'Workflow ID is required' });
  }

  let workflow;

  // First check registry for temporary workflows
  workflow = WorkflowRegistry.getWorkflow(workflowId);

  if (!workflow) {
    try {
      workflow = mastra.getWorkflow(workflowId);
    } catch (error) {
      logger.debug('Error getting workflow, searching agents for workflow', error);
    }
  }

  if (!workflow) {
    logger.debug('Workflow not found, searching agents for workflow', { workflowId });
    const agents = mastra.getAgents();

    if (Object.keys(agents || {}).length) {
      for (const [_, agent] of Object.entries(agents)) {
        try {
          const workflows = await agent.getWorkflows();

          if (workflows[workflowId]) {
            workflow = workflows[workflowId];
            break;
          }
          break;
        } catch (error) {
          logger.debug('Error getting workflow from agent', error);
        }
      }
    }
  }

  if (!workflow) {
    throw new HTTPException(404, { message: 'Workflow not found' });
  }

  return { workflow };
}

export async function getWorkflowByIdHandler({ mastra, workflowId }: WorkflowContext): Promise<WorkflowInfo> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    return getWorkflowInfo(workflow);
  } catch (error) {
    return handleError(error, 'Error getting workflow');
  }
}

export async function getWorkflowRunByIdHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>): Promise<ReturnType<Workflow['getWorkflowRunById']>> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'Run ID is required' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    return run;
  } catch (error) {
    return handleError(error, 'Error getting workflow run');
  }
}

export async function getWorkflowRunExecutionResultHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>): Promise<WatchEvent['payload']['workflowState']> {
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

    const executionResult = await workflow.getWorkflowRunExecutionResult(runId);

    if (!executionResult) {
      throw new HTTPException(404, { message: 'Workflow run execution result not found' });
    }

    return executionResult;
  } catch (error) {
    return handleError(error, 'Error getting workflow run execution result');
  }
}

export async function createWorkflowRunHandler({
  mastra,
  workflowId,
  runId: prevRunId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.createRunAsync({ runId: prevRunId });

    return { runId: run.runId };
  } catch (error) {
    return handleError(error, 'Error creating workflow run');
  }
}

export async function startAsyncWorkflowHandler({
  mastra,
  runtimeContext,
  workflowId,
  runId,
  inputData,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  runtimeContext?: RuntimeContext;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const _run = await workflow.createRunAsync({ runId });
    const result = await _run.start({
      inputData,
      runtimeContext,
    });
    return result;
  } catch (error) {
    return handleError(error, 'Error starting async workflow');
  }
}

export async function startWorkflowRunHandler({
  mastra,
  runtimeContext,
  workflowId,
  runId,
  inputData,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
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

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = await workflow.createRunAsync({ runId });
    void _run.start({
      inputData,
      runtimeContext,
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
  eventType = 'watch',
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  eventType?: 'watch' | 'watch-v2';
}): Promise<ReadableStream<string>> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to watch workflow' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = await workflow.createRunAsync({ runId });
    let unwatch: () => void;
    let asyncRef: NodeJS.Immediate | null = null;
    const stream = new ReadableStream<string>({
      start(controller) {
        unwatch = _run.watch((event: any) => {
          const { type, payload, eventTimestamp } = event;
          controller.enqueue(JSON.stringify({ type, payload, eventTimestamp, runId }));

          if (asyncRef) {
            clearImmediate(asyncRef);
            asyncRef = null;
          }

          // a run is finished if the status is not running
          asyncRef = setImmediate(async () => {
            const runDone = eventType === 'watch' ? payload.workflowState.status !== 'running' : type === 'finish';
            if (runDone) {
              controller.close();
              unwatch?.();
            }
          });
        }, eventType);
      },
      cancel() {
        if (asyncRef) {
          clearImmediate(asyncRef);
          asyncRef = null;
        }
        unwatch?.();
      },
    });

    return stream;
  } catch (error) {
    return handleError(error, 'Error watching workflow');
  }
}

export async function streamWorkflowHandler({
  mastra,
  runtimeContext,
  workflowId,
  runId,
  inputData,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  runtimeContext?: RuntimeContext;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const serverCache = mastra.getServerCache();

    const run = await workflow.createRunAsync({ runId });
    const result = run.stream({
      inputData,
      runtimeContext,
      onChunk: async chunk => {
        if (serverCache) {
          const cacheKey = runId;
          await serverCache.listPush(cacheKey, chunk);
        }
      },
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error executing workflow');
  }
}

export async function observeStreamWorkflowHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to observe workflow stream' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = await workflow.createRunAsync({ runId });
    const serverCache = mastra.getServerCache();
    if (!serverCache) {
      throw new HTTPException(500, { message: 'Server cache not found' });
    }

    const transformStream = new TransformStream<StreamEvent, StreamEvent>();

    const writer = transformStream.writable.getWriter();

    const cachedRunChunks = await serverCache.listFromTo(runId, 0);

    for (const chunk of cachedRunChunks) {
      await writer.write(chunk as any);
    }

    writer.releaseLock();

    const result = _run.observeStream();
    return result.stream?.pipeThrough(transformStream);
  } catch (error) {
    return handleError(error, 'Error observing workflow stream');
  }
}

export async function streamVNextWorkflowHandler({
  mastra,
  runtimeContext,
  workflowId,
  runId,
  inputData,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  runtimeContext?: RuntimeContext;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to stream workflow' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.createRunAsync({ runId });
    const result = run.streamVNext({
      inputData,
      runtimeContext,
    });
    return result;
  } catch (error) {
    return handleError(error, 'Error streaming workflow');
  }
}

export async function resumeAsyncWorkflowHandler({
  mastra,
  workflowId,
  runId,
  body,
  runtimeContext,
}: WorkflowContext & {
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

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = await workflow.createRunAsync({ runId });
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

export async function resumeWorkflowHandler({
  mastra,
  workflowId,
  runId,
  body,
  runtimeContext,
}: WorkflowContext & {
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

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = await workflow.createRunAsync({ runId });

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

export async function getWorkflowRunsHandler({
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
}): Promise<WorkflowRuns> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const workflowRuns = (await workflow.getWorkflowRuns({ fromDate, toDate, limit, offset, resourceId })) || {
      runs: [],
      total: 0,
    };
    return workflowRuns;
  } catch (error) {
    return handleError(error, 'Error getting workflow runs');
  }
}

export async function cancelWorkflowRunHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to cancel workflow run' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = await workflow.createRunAsync({ runId });

    await _run.cancel();

    return { message: 'Workflow run cancelled' };
  } catch (error) {
    return handleError(error, 'Error canceling workflow run');
  }
}

export async function sendWorkflowRunEventHandler({
  mastra,
  workflowId,
  runId,
  event,
  data,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  event: string;
  data: unknown;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to send workflow run event' });
    }

    const { workflow } = await getWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const _run = await workflow.createRunAsync({ runId });

    await _run.sendEvent(event, data);

    return { message: 'Workflow run event sent' };
  } catch (error) {
    return handleError(error, 'Error sending workflow run event');
  }
}
