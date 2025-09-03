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
} from '@mastra/server/handlers/agent-builder';
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

export async function startAsyncAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const actionId = c.req.param('actionId');
    const { inputData } = await c.req.json();
    const runId = c.req.query('runId');

    const result = await getOriginalStartAsyncAgentBuilderActionHandler({
      mastra,
      runtimeContext,
      actionId,
      runId,
      inputData,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error starting async agent builder action');
  }
}

export async function startAgentBuilderActionRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const actionId = c.req.param('actionId');
    const { inputData } = await c.req.json();
    const runId = c.req.query('runId');

    const result = await getOriginalStartAgentBuilderActionRunHandler({
      mastra,
      runtimeContext,
      actionId,
      runId,
      inputData,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error starting agent builder action run');
  }
}

export async function watchAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');
    const eventType = c.req.query('eventType') as 'watch' | 'watch-v2' | undefined;

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to watch action' });
    }

    c.header('Transfer-Encoding', 'chunked');

    return stream(c, async stream => {
      try {
        const result = await getOriginalWatchAgentBuilderActionHandler({
          mastra,
          actionId,
          runId,
          eventType,
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
    });
  } catch (error) {
    return handleError(error, 'Error watching agent builder action');
  }
}

export async function streamAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const logger = mastra.getLogger();
    const actionId = c.req.param('actionId');
    const { inputData } = await c.req.json();
    const runId = c.req.query('runId');

    c.header('Transfer-Encoding', 'chunked');
    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalStreamAgentBuilderActionHandler({
            mastra,
            actionId,
            runId,
            inputData,
            runtimeContext,
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
          logger.error('Error in action stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
        await stream.close();
      },
      async err => {
        logger.error('Error in action stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error streaming agent builder action');
  }
}

export async function streamVNextAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext = c.get('runtimeContext');
    const logger = mastra.getLogger();
    const actionId = c.req.param('actionId');
    const { inputData } = await c.req.json();
    const runId = c.req.query('runId');

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalStreamVNextAgentBuilderActionHandler({
            mastra,
            actionId,
            runId,
            inputData,
            runtimeContext,
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
          logger.error('Error in action VNext stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in action VNext stream: ' + err?.message);
      },
    );
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
    const { step, resumeData } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume action' });
    }

    const result = await getOriginalResumeAsyncAgentBuilderActionHandler({
      mastra,
      runtimeContext,
      actionId,
      runId,
      body: { step, resumeData },
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
    const { step, resumeData } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume action' });
    }

    await getOriginalResumeAgentBuilderActionHandler({
      mastra,
      runtimeContext,
      actionId,
      runId,
      body: { step, resumeData },
    });

    return c.json({ message: 'Action run resumed' });
  } catch (error) {
    return handleError(error, 'Error resuming agent builder action');
  }
}

export async function getAgentBuilderActionRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');
    const { fromDate, toDate, limit, offset, resourceId } = c.req.query();

    const runs = await getOriginalGetAgentBuilderActionRunsHandler({
      mastra,
      actionId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
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
    const { event, data } = await c.req.json();

    const result = await getOriginalSendAgentBuilderActionRunEventHandler({
      mastra,
      actionId,
      runId,
      event,
      data,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error sending agent builder action run event');
  }
}
