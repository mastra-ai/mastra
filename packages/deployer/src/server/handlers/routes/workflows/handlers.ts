import type { Mastra } from '@mastra/core/mastra';
import {
  listWorkflowsHandler as getOriginalWorkflowsHandler,
  getWorkflowByIdHandler as getOriginalWorkflowByIdHandler,
  startAsyncWorkflowHandler as getOriginalStartAsyncWorkflowHandler,
  createWorkflowRunHandler as getOriginalCreateWorkflowRunHandler,
  startWorkflowRunHandler as getOriginalStartWorkflowRunHandler,
  streamLegacyWorkflowHandler as getOriginalStreamLegacyWorkflowHandler,
  streamVNextWorkflowHandler as getOriginalStreamVNextWorkflowHandler,
  resumeAsyncWorkflowHandler as getOriginalResumeAsyncWorkflowHandler,
  resumeWorkflowHandler as getOriginalResumeWorkflowHandler,
  listWorkflowRunsHandler as getOriginalListWorkflowRunsHandler,
  getWorkflowRunByIdHandler as getOriginalGetWorkflowRunByIdHandler,
  getWorkflowRunExecutionResultHandler as getOriginalGetWorkflowRunExecutionResultHandler,
  cancelWorkflowRunHandler as getOriginalCancelWorkflowRunHandler,
  observeStreamLegacyWorkflowHandler as getOriginalObserveStreamLegacyWorkflowHandler,
  resumeStreamWorkflowHandler as getOriginalResumeStreamWorkflowHandler,
  observeStreamVNextWorkflowHandler as getOriginalObserveStreamVNextWorkflowHandler,
} from '@mastra/server/handlers/workflows';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { stream } from 'hono/streaming';

import { handleError } from '../../error';
import { parsePage, parsePerPage } from '../../utils/query-parsers';

export async function listWorkflowsHandler(c: Context) {
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
    const requestContext = c.get('requestContext');
    const workflowId = c.req.param('workflowId');
    const { inputData, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    const result = await getOriginalStartAsyncWorkflowHandler({
      mastra,
      requestContext,
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
    const requestContext = c.get('requestContext');
    const workflowId = c.req.param('workflowId');
    const { inputData, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    await getOriginalStartWorkflowRunHandler({
      mastra,
      requestContext,
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

export async function streamWorkflowHandler(c: Context) {
  return streamVNextWorkflowHandler(c);
}

export async function observeStreamWorkflowHandler(c: Context) {
  return observeStreamVNextWorkflowHandler(c);
}

export async function streamVNextWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const requestContext = c.get('requestContext');
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
            requestContext,
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
          logger.error('Error in workflow stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in workflow stream: ' + err?.message);
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
          logger.error('Error in workflow observe stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in workflow observe stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error observing workflow stream');
  }
}

export async function streamLegacyWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const requestContext = c.get('requestContext');
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
            requestContext,
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
    const requestContext = c.get('requestContext');
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
            requestContext,
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
    const requestContext = c.get('requestContext');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');
    const { step, resumeData, tracingOptions } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const result = await getOriginalResumeAsyncWorkflowHandler({
      mastra,
      requestContext,
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
    const requestContext = c.get('requestContext');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');
    const { step, resumeData, tracingOptions } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    await getOriginalResumeWorkflowHandler({
      mastra,
      requestContext,
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

export async function listWorkflowRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const { fromDate, toDate, perPage: perPageRaw, page: pageRaw, resourceId } = c.req.query();
    const workflowRuns = await getOriginalListWorkflowRunsHandler({
      mastra,
      workflowId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      perPage: perPageRaw !== undefined ? parsePerPage(perPageRaw) : undefined,
      page: pageRaw !== undefined ? parsePage(pageRaw) : undefined,
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
