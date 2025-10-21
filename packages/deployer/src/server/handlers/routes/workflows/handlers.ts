import type { Mastra } from '@mastra/core';
import {
  getWorkflowsHandler as getOriginalWorkflowsHandler,
  getWorkflowByIdHandler as getOriginalWorkflowByIdHandler,
  startAsyncWorkflowHandler as getOriginalStartAsyncWorkflowHandler,
  createWorkflowRunHandler as getOriginalCreateWorkflowRunHandler,
  startWorkflowRunHandler as getOriginalStartWorkflowRunHandler,
  watchWorkflowHandler as getOriginalWatchWorkflowHandler,
  streamLegacyWorkflowHandler as getOriginalStreamLegacyWorkflowHandler,
  streamVNextWorkflowHandler as getOriginalStreamVNextWorkflowHandler,
  resumeAsyncWorkflowHandler as getOriginalResumeAsyncWorkflowHandler,
  resumeWorkflowHandler as getOriginalResumeWorkflowHandler,
  getWorkflowRunsHandler as getOriginalGetWorkflowRunsHandler,
  getWorkflowRunByIdHandler as getOriginalGetWorkflowRunByIdHandler,
  getWorkflowRunExecutionResultHandler as getOriginalGetWorkflowRunExecutionResultHandler,
  cancelWorkflowRunHandler as getOriginalCancelWorkflowRunHandler,
  sendWorkflowRunEventHandler as getOriginalSendWorkflowRunEventHandler,
  observeStreamLegacyWorkflowHandler as getOriginalObserveStreamLegacyWorkflowHandler,
  resumeStreamWorkflowHandler as getOriginalResumeStreamWorkflowHandler,
  observeStreamVNextWorkflowHandler as getOriginalObserveStreamVNextWorkflowHandler,
} from '@mastra/server/handlers/workflows';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { stream } from 'hono/streaming';

import { handleError } from '../../error';

export async function getWorkflowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');

    const workflows = await getOriginalWorkflowsHandler({
      mastra,
    });

    return c.json(workflows);
  } catch (error) {
    return handleError(error, 'Error getting workflows');
  }
}

export async function getWorkflowByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');

    const workflow = await getOriginalWorkflowByIdHandler({
      mastra,
      workflowId,
    });

    return c.json(workflow);
  } catch (error) {
    return handleError(error, 'Error getting workflow');
  }
}

export async function createWorkflowRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const prevRunId = c.req.query('runId');

    const result = await getOriginalCreateWorkflowRunHandler({
      mastra,
      workflowId,
      runId: prevRunId,
    });

    return c.json(result);
  } catch (e) {
    return handleError(e, 'Error creating run');
  }
}

export async function startAsyncWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const workflowId = c.req.param('workflowId');
    const { inputData, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    const result = await getOriginalStartAsyncWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      inputData,
      tracingOptions,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error executing workflow');
  }
}

export async function startWorkflowRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const workflowId = c.req.param('workflowId');
    const { inputData, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    await getOriginalStartWorkflowRunHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      inputData,
      tracingOptions,
    });

    return c.json({ message: 'Workflow run started' });
  } catch (e) {
    return handleError(e, 'Error starting workflow run');
  }
}

export function watchWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to watch workflow' });
    }

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalWatchWorkflowHandler({
            mastra,
            workflowId,
            runId,
          });

          const reader = result.getReader();

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          logger.error('Error in watch stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in watch stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error watching workflow');
  }
}

export async function streamWorkflowHandler(c: Context) {
  return streamVNextWorkflowHandler(c);
}

export async function observeStreamWorkflowHandler(c: Context) {
  return observeStreamVNextWorkflowHandler(c);
}

export async function streamVNextWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const logger = mastra.getLogger();
    const workflowId = c.req.param('workflowId');
    const { inputData, closeOnSuspend, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalStreamVNextWorkflowHandler({
            mastra,
            workflowId,
            runId,
            inputData,
            runtimeContext,
            closeOnSuspend,
            tracingOptions,
          });

          const reader = result.getReader();

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          logger.error('Error in workflow VNext stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in workflow VNext stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error streaming workflow');
  }
}

export async function observeStreamVNextWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalObserveStreamVNextWorkflowHandler({
            mastra,
            workflowId,
            runId,
          });

          const reader = result.getReader();

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          logger.error('Error in workflow VNext observe stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in workflow VNext observe stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error observing vNext workflow stream');
  }
}

export async function streamLegacyWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const logger = mastra.getLogger();
    const workflowId = c.req.param('workflowId');
    const { inputData, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalStreamLegacyWorkflowHandler({
            mastra,
            workflowId,
            runId,
            inputData,
            runtimeContext,
            tracingOptions,
          });

          const reader = result.stream.getReader();

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          logger.error('Error in workflow stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
        await stream.close();
      },
      async err => {
        logger.error('Error in workflow stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error streaming workflow');
  }
}

export async function observeStreamLegacyWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to observe workflow stream' });
    }

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalObserveStreamLegacyWorkflowHandler({
            mastra,
            workflowId,
            runId,
          });

          const reader = result.getReader();

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          logger.error('Error in workflow observe stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
        await stream.close();
      },
      async err => {
        logger.error('Error in workflow observe stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error observing workflow stream');
  }
}

export async function resumeStreamWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const logger = mastra.getLogger();
    const workflowId = c.req.param('workflowId');
    const { step, resumeData, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalResumeStreamWorkflowHandler({
            mastra,
            workflowId,
            runId,
            body: { step, resumeData },
            runtimeContext,
            tracingOptions,
          });

          const reader = result.getReader();

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          logger.error('Error in workflow VNext stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in workflow VNext stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error streaming workflow');
  }
}

export async function resumeAsyncWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');
    const { step, resumeData, tracingOptions } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const result = await getOriginalResumeAsyncWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      body: { step, resumeData },
      tracingOptions,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error resuming workflow step');
  }
}

export async function resumeWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');
    const { step, resumeData, tracingOptions } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    await getOriginalResumeWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      body: { step, resumeData },
      tracingOptions,
    });

    return c.json({ message: 'Workflow run resumed' });
  } catch (error) {
    return handleError(error, 'Error resuming workflow');
  }
}

export async function getWorkflowRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const { fromDate, toDate, limit, offset, resourceId } = c.req.query();
    const workflowRuns = await getOriginalGetWorkflowRunsHandler({
      mastra,
      workflowId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      resourceId,
    });

    return c.json(workflowRuns);
  } catch (error) {
    return handleError(error, 'Error getting workflow runs');
  }
}

export async function getWorkflowRunByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.param('runId');
    const workflowRun = await getOriginalGetWorkflowRunByIdHandler({
      mastra,
      workflowId,
      runId,
    });

    return c.json(workflowRun);
  } catch (error) {
    return handleError(error, 'Error getting workflow run');
  }
}

export async function getWorkflowRunExecutionResultHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.param('runId');
    const workflowRunExecutionResult = await getOriginalGetWorkflowRunExecutionResultHandler({
      mastra,
      workflowId,
      runId,
    });

    return c.json(workflowRunExecutionResult);
  } catch (error) {
    return handleError(error, 'Error getting workflow run execution result');
  }
}

export async function cancelWorkflowRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.param('runId');

    const result = await getOriginalCancelWorkflowRunHandler({
      mastra,
      workflowId,
      runId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error canceling workflow run');
  }
}

export async function sendWorkflowRunEventHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.param('runId');
    const { event, data } = await c.req.json();

    const result = await getOriginalSendWorkflowRunEventHandler({
      mastra,
      workflowId,
      runId,
      event,
      data,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error sending workflow run event');
  }
}
