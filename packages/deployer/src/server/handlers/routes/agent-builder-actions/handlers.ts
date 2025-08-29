import type { Mastra } from '@mastra/core';
import {
  getWorkflowsHandler as getOriginalWorkflowsHandler,
  getWorkflowByIdHandler as getOriginalWorkflowByIdHandler,
  startAsyncWorkflowHandler as getOriginalStartAsyncWorkflowHandler,
  createWorkflowRunHandler as getOriginalCreateWorkflowRunHandler,
  startWorkflowRunHandler as getOriginalStartWorkflowRunHandler,
  watchWorkflowHandler as getOriginalWatchWorkflowHandler,
  streamWorkflowHandler as getOriginalStreamWorkflowHandler,
  streamVNextWorkflowHandler as getOriginalStreamVNextWorkflowHandler,
  resumeAsyncWorkflowHandler as getOriginalResumeAsyncWorkflowHandler,
  resumeWorkflowHandler as getOriginalResumeWorkflowHandler,
  getWorkflowRunsHandler as getOriginalGetWorkflowRunsHandler,
  getWorkflowRunByIdHandler as getOriginalGetWorkflowRunByIdHandler,
  getWorkflowRunExecutionResultHandler as getOriginalGetWorkflowRunExecutionResultHandler,
  cancelWorkflowRunHandler as getOriginalCancelWorkflowRunHandler,
  sendWorkflowRunEventHandler as getOriginalSendWorkflowRunEventHandler,
} from '@mastra/server/handlers/workflows';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { stream } from 'hono/streaming';

import { handleError } from '../../error';

export async function getAgentBuilderActionsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');

    const workflows = await getOriginalWorkflowsHandler({
      mastra,
    });

    return c.json(workflows);
  } catch (error) {
    return handleError(error, 'Error getting agent builder actions');
  }
}

export async function getAgentBuilderActionByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');

    const workflow = await getOriginalWorkflowByIdHandler({
      mastra,
      workflowId: actionId,
    });

    return c.json(workflow);
  } catch (error) {
    return handleError(error, 'Error getting agent builder action by ID');
  }
}

export async function startAsyncAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');
    const body = await c.req.json();

    const result = await getOriginalStartAsyncWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId: actionId,
      runId,
      ...body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error starting async agent builder action');
  }
}

export async function createAgentBuilderActionRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');

    const result = await getOriginalCreateWorkflowRunHandler({
      mastra,
      workflowId: actionId,
      runId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error creating agent builder action run');
  }
}

export async function startAgentBuilderActionRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');
    const body = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId is required' });
    }

    const result = await getOriginalStartWorkflowRunHandler({
      mastra,
      runtimeContext,
      workflowId: actionId,
      runId,
      ...body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error starting agent builder action run');
  }
}

export async function watchAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');

    return stream(c, async stream => {
      const originalStream = await getOriginalWatchWorkflowHandler({
        mastra,
        workflowId: actionId,
        runId,
      });

      if (originalStream instanceof ReadableStream) {
        const reader = originalStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await stream.write(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
    });
  } catch (error) {
    return handleError(error, 'Error watching agent builder action');
  }
}

export async function streamAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');
    const body = await c.req.json();

    return stream(c, async stream => {
      const originalStream = await getOriginalStreamWorkflowHandler({
        mastra,
        runtimeContext,
        workflowId: actionId,
        runId,
        ...body,
      });

      if (originalStream instanceof ReadableStream) {
        const reader = originalStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await stream.write(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
    });
  } catch (error) {
    return handleError(error, 'Error streaming agent builder action');
  }
}

export async function streamVNextAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');
    const body = await c.req.json();

    return stream(c, async stream => {
      const originalStream = await getOriginalStreamVNextWorkflowHandler({
        mastra,
        runtimeContext,
        workflowId: actionId,
        runId,
        ...body,
      });

      if (originalStream instanceof ReadableStream) {
        const reader = originalStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await stream.write(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
    });
  } catch (error) {
    return handleError(error, 'Error streaming VNext agent builder action');
  }
}

export async function resumeAsyncAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');
    const body = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId is required' });
    }

    const result = await getOriginalResumeAsyncWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId: actionId,
      runId,
      ...body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error resuming async agent builder action');
  }
}

export async function resumeAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');
    const body = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId is required' });
    }

    const result = await getOriginalResumeWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId: actionId,
      runId,
      ...body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error resuming agent builder action');
  }
}

export async function getAgentBuilderActionRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');
    const fromDate = c.req.query('fromDate');
    const toDate = c.req.query('toDate');
    const limit = c.req.query('limit');
    const offset = c.req.query('offset');
    const resourceId = c.req.query('resourceId');

    const runs = await getOriginalGetWorkflowRunsHandler({
      mastra,
      workflowId: actionId,
      fromDate,
      toDate,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      resourceId,
    });

    return c.json(runs);
  } catch (error) {
    return handleError(error, 'Error getting agent builder action runs');
  }
}

export async function getAgentBuilderActionRunByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');
    const runId = c.req.param('runId');

    const run = await getOriginalGetWorkflowRunByIdHandler({
      mastra,
      workflowId: actionId,
      runId,
    });

    return c.json(run);
  } catch (error) {
    return handleError(error, 'Error getting agent builder action run by ID');
  }
}

export async function getAgentBuilderActionRunExecutionResultHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');
    const runId = c.req.param('runId');

    const result = await getOriginalGetWorkflowRunExecutionResultHandler({
      mastra,
      workflowId: actionId,
      runId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting agent builder action run execution result');
  }
}

export async function cancelAgentBuilderActionRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');
    const runId = c.req.param('runId');

    const result = await getOriginalCancelWorkflowRunHandler({
      mastra,
      workflowId: actionId,
      runId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error cancelling agent builder action run');
  }
}

export async function sendAgentBuilderActionRunEventHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');
    const runId = c.req.param('runId');
    const body = await c.req.json();

    const result = await getOriginalSendWorkflowRunEventHandler({
      mastra,
      workflowId: actionId,
      runId,
      ...body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error sending agent builder action run event');
  }
}