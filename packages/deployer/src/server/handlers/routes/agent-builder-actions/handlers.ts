import type { Mastra } from '@mastra/core';
import {
  getAgentBuilderActionsHandler as getOriginalAgentBuilderActionsHandler,
  getAgentBuilderActionByIdHandler as getOriginalAgentBuilderActionByIdHandler,
  startAsyncAgentBuilderActionHandler as getOriginalStartAsyncAgentBuilderActionHandler,
  createAgentBuilderActionRunHandler as getOriginalCreateAgentBuilderActionRunHandler,
  startAgentBuilderActionRunHandler as getOriginalStartAgentBuilderActionRunHandler,
  watchAgentBuilderActionHandler as getOriginalWatchAgentBuilderActionHandler,
  streamAgentBuilderActionHandler as getOriginalStreamAgentBuilderActionHandler,
  streamVNextAgentBuilderActionHandler as getOriginalStreamVNextAgentBuilderActionHandler,
  resumeAsyncAgentBuilderActionHandler as getOriginalResumeAsyncAgentBuilderActionHandler,
  resumeAgentBuilderActionHandler as getOriginalResumeAgentBuilderActionHandler,
  getAgentBuilderActionRunsHandler as getOriginalGetAgentBuilderActionRunsHandler,
  getAgentBuilderActionRunByIdHandler as getOriginalGetAgentBuilderActionRunByIdHandler,
  getAgentBuilderActionRunExecutionResultHandler as getOriginalGetAgentBuilderActionRunExecutionResultHandler,
  cancelAgentBuilderActionRunHandler as getOriginalCancelAgentBuilderActionRunHandler,
  sendAgentBuilderActionRunEventHandler as getOriginalSendAgentBuilderActionRunEventHandler,
} from '@mastra/server/handlers/agent-builder-actions';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { stream } from 'hono/streaming';

import { handleError } from '../../error';

export async function getAgentBuilderActionsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');

    const actions = await getOriginalAgentBuilderActionsHandler({
      mastra,
    });

    return c.json(actions);
  } catch (error) {
    return handleError(error, 'Error getting agent builder actions');
  }
}

export async function getAgentBuilderActionByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');

    const action = await getOriginalAgentBuilderActionByIdHandler({
      mastra,
      actionId,
    });

    return c.json(action);
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

    const result = await getOriginalStartAsyncAgentBuilderActionHandler({
      mastra,
      runtimeContext,
      actionId,
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

    const result = await getOriginalCreateAgentBuilderActionRunHandler({
      mastra,
      actionId,
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

    const result = await getOriginalStartAgentBuilderActionRunHandler({
      mastra,
      runtimeContext,
      actionId,
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
      const originalStream = await getOriginalWatchAgentBuilderActionHandler({
        mastra,
        actionId,
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
      const originalStream = await getOriginalStreamAgentBuilderActionHandler({
        mastra,
        runtimeContext,
        actionId,
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
      const originalStream = await getOriginalStreamVNextAgentBuilderActionHandler({
        mastra,
        runtimeContext,
        actionId,
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

    const result = await getOriginalResumeAsyncAgentBuilderActionHandler({
      mastra,
      runtimeContext,
      actionId,
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

    const result = await getOriginalResumeAgentBuilderActionHandler({
      mastra,
      runtimeContext,
      actionId,
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

    const runs = await getOriginalGetAgentBuilderActionRunsHandler({
      mastra,
      actionId,
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

    const run = await getOriginalGetAgentBuilderActionRunByIdHandler({
      mastra,
      actionId,
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

    const result = await getOriginalGetAgentBuilderActionRunExecutionResultHandler({
      mastra,
      actionId,
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

    const result = await getOriginalCancelAgentBuilderActionRunHandler({
      mastra,
      actionId,
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

    const result = await getOriginalSendAgentBuilderActionRunEventHandler({
      mastra,
      actionId,
      runId,
      ...body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error sending agent builder action run event');
  }
}