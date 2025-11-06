import type { Mastra } from '@mastra/core/mastra';
import {
  getAgentBuilderActionsHandler as getOriginalAgentBuilderActionsHandler,
  getAgentBuilderActionByIdHandler as getOriginalAgentBuilderActionByIdHandler,
  startAsyncAgentBuilderActionHandler as getOriginalStartAsyncAgentBuilderActionHandler,
  createAgentBuilderActionRunHandler as getOriginalCreateAgentBuilderActionRunHandler,
  startAgentBuilderActionRunHandler as getOriginalStartAgentBuilderActionRunHandler,
  streamAgentBuilderActionHandler as getOriginalStreamAgentBuilderActionHandler,
  streamLegacyAgentBuilderActionHandler as getOriginalStreamLegacyAgentBuilderActionHandler,
  streamVNextAgentBuilderActionHandler as getOriginalStreamVNextAgentBuilderActionHandler,
  observeStreamLegacyAgentBuilderActionHandler as getOriginalObserveStreamLegacyAgentBuilderActionHandler,
  observeStreamAgentBuilderActionHandler as getOriginalObserveStreamAgentBuilderActionHandler,
  observeStreamVNextAgentBuilderActionHandler as getOriginalObserveStreamVNextAgentBuilderActionHandler,
  resumeAsyncAgentBuilderActionHandler as getOriginalResumeAsyncAgentBuilderActionHandler,
  resumeAgentBuilderActionHandler as getOriginalResumeAgentBuilderActionHandler,
  resumeStreamAgentBuilderActionHandler as getOriginalResumeStreamAgentBuilderActionHandler,
  getAgentBuilderActionRunsHandler as getOriginalGetAgentBuilderActionRunsHandler,
  getAgentBuilderActionRunByIdHandler as getOriginalGetAgentBuilderActionRunByIdHandler,
  getAgentBuilderActionRunExecutionResultHandler as getOriginalGetAgentBuilderActionRunExecutionResultHandler,
  cancelAgentBuilderActionRunHandler as getOriginalCancelAgentBuilderActionRunHandler,
} from '@mastra/server/handlers/agent-builder';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { stream } from 'hono/streaming';

import { disableHotReload, enableHotReload } from '../../client';
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
    const requestContext = c.get('requestContext');
    const actionId = c.req.param('actionId');
    const { inputData, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    disableHotReload();
    const result = await getOriginalStartAsyncAgentBuilderActionHandler({
      mastra,
      requestContext,
      actionId,
      runId,
      inputData,
      tracingOptions,
    });

    enableHotReload();
    return c.json(result);
  } catch (error) {
    enableHotReload();
    return handleError(error, 'Error starting async agent builder action');
  }
}

export async function startAgentBuilderActionRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const requestContext = c.get('requestContext');
    const actionId = c.req.param('actionId');
    const { inputData, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    await getOriginalStartAgentBuilderActionRunHandler({
      mastra,
      requestContext,
      actionId,
      runId,
      inputData,
      tracingOptions,
    });

    return c.json({ message: 'Agent builder action run started' });
  } catch (error) {
    return handleError(error, 'Error starting agent builder action run');
  }
}

export async function streamAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const requestContext = c.get('requestContext');
    const logger = mastra.getLogger();
    const actionId = c.req.param('actionId');
    const { inputData, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    c.header('Transfer-Encoding', 'chunked');
    return stream(
      c,
      async stream => {
        try {
          disableHotReload();
          const result = await getOriginalStreamAgentBuilderActionHandler({
            mastra,
            actionId,
            runId,
            inputData,
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
          logger.error('Error in action stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
        await stream.close();
        enableHotReload();
      },
      async err => {
        logger.error('Error in action stream: ' + err?.message);
      },
    );
  } catch (error) {
    enableHotReload();
    return handleError(error, 'Error streaming agent builder action');
  }
}

export async function streamVNextAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const requestContext = c.get('requestContext');
    const logger = mastra.getLogger();
    const actionId = c.req.param('actionId');
    const { inputData, closeOnSuspend, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          disableHotReload();
          const result = await getOriginalStreamVNextAgentBuilderActionHandler({
            mastra,
            actionId,
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
          logger.error('Error in action VNext stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
        enableHotReload();
      },
      async err => {
        logger.error('Error in action VNext stream: ' + err?.message);
      },
    );
  } catch (error) {
    enableHotReload();
    return handleError(error, 'Error streaming VNext agent builder action');
  }
}

export async function resumeAsyncAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const requestContext = c.get('requestContext');
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');
    const { step, resumeData, tracingOptions } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume action' });
    }

    disableHotReload();
    const result = await getOriginalResumeAsyncAgentBuilderActionHandler({
      mastra,
      requestContext,
      actionId,
      runId,
      body: { step, resumeData },
      tracingOptions,
    });

    enableHotReload();
    return c.json(result);
  } catch (error) {
    enableHotReload();
    return handleError(error, 'Error resuming async agent builder action');
  }
}

export async function resumeAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const requestContext = c.get('requestContext');
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');
    const { step, resumeData, tracingOptions } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume action' });
    }

    disableHotReload();
    await getOriginalResumeAgentBuilderActionHandler({
      mastra,
      requestContext,
      actionId,
      runId,
      body: { step, resumeData },
      tracingOptions,
    });

    enableHotReload();
    return c.json({ message: 'Action run resumed' });
  } catch (error) {
    enableHotReload();
    return handleError(error, 'Error resuming agent builder action');
  }
}

export async function getAgentBuilderActionRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const actionId = c.req.param('actionId');
    const queryParams = c.req.query();
    const { fromDate, toDate, perPage, page, resourceId } = queryParams;

    const runs = await getOriginalGetAgentBuilderActionRunsHandler({
      mastra,
      actionId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      perPage: perPage !== null && perPage !== undefined && !isNaN(Number(perPage)) ? Number(perPage) : undefined,
      page: page !== null && page !== undefined && !isNaN(Number(page)) ? Number(page) : undefined,
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

export async function streamLegacyAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const requestContext = c.get('requestContext');
    const logger = mastra.getLogger();
    const actionId = c.req.param('actionId');
    const { inputData, tracingOptions } = await c.req.json();
    const runId = c.req.query('runId');

    c.header('Transfer-Encoding', 'chunked');
    return stream(
      c,
      async stream => {
        try {
          disableHotReload();
          const result = await getOriginalStreamLegacyAgentBuilderActionHandler({
            mastra,
            actionId,
            runId,
            inputData,
            requestContext,
            tracingOptions,
          });

          const reader = result?.stream?.getReader();

          if (!reader) {
            throw new Error('No reader available from legacy stream');
          }

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          logger.error('Error in action legacy stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
        await stream.close();
        enableHotReload();
      },
      async err => {
        logger.error('Error in action legacy stream: ' + err?.message);
      },
    );
  } catch (error) {
    enableHotReload();
    return handleError(error, 'Error streaming legacy agent builder action');
  }
}

export async function observeStreamLegacyAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to observe stream' });
    }

    c.header('Transfer-Encoding', 'chunked');

    return stream(c, async stream => {
      try {
        disableHotReload();
        const result = await getOriginalObserveStreamLegacyAgentBuilderActionHandler({
          mastra,
          actionId,
          runId,
        });

        const reader = result?.getReader();

        if (!reader) {
          throw new Error('No reader available from observe stream');
        }

        stream.onAbort(() => {
          void reader.cancel('request aborted');
        });

        let chunkResult;
        while ((chunkResult = await reader.read()) && !chunkResult.done) {
          await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
        }
        enableHotReload();
      } catch (err) {
        enableHotReload();
        logger.error('Error in observe legacy stream: ' + ((err as Error)?.message ?? 'Unknown error'));
      }
    });
  } catch (error) {
    enableHotReload();
    return handleError(error, 'Error observing legacy stream for agent builder action');
  }
}

export async function observeStreamAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to observe stream' });
    }

    c.header('Transfer-Encoding', 'chunked');

    return stream(c, async stream => {
      try {
        disableHotReload();
        const result = await getOriginalObserveStreamAgentBuilderActionHandler({
          mastra,
          actionId,
          runId,
        });

        const reader = result?.getReader();

        if (!reader) {
          throw new Error('No reader available from observe stream');
        }

        stream.onAbort(() => {
          void reader.cancel('request aborted');
        });

        let chunkResult;
        while ((chunkResult = await reader.read()) && !chunkResult.done) {
          await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
        }
        enableHotReload();
      } catch (err) {
        enableHotReload();
        logger.error('Error in observe stream: ' + ((err as Error)?.message ?? 'Unknown error'));
      }
    });
  } catch (error) {
    enableHotReload();
    return handleError(error, 'Error observing stream for agent builder action');
  }
}

export async function observeStreamVNextAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to observe stream' });
    }

    c.header('Transfer-Encoding', 'chunked');

    return stream(c, async stream => {
      try {
        disableHotReload();
        const result = await getOriginalObserveStreamVNextAgentBuilderActionHandler({
          mastra,
          actionId,
          runId,
        });

        const reader = result?.getReader();

        if (!reader) {
          throw new Error('No reader available from observe stream VNext');
        }

        stream.onAbort(() => {
          void reader.cancel('request aborted');
        });

        let chunkResult;
        while ((chunkResult = await reader.read()) && !chunkResult.done) {
          await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
        }
        enableHotReload();
      } catch (err) {
        enableHotReload();
        logger.error('Error in observe VNext stream: ' + ((err as Error)?.message ?? 'Unknown error'));
      }
    });
  } catch (error) {
    enableHotReload();
    return handleError(error, 'Error observing VNext stream for agent builder action');
  }
}

export async function resumeStreamAgentBuilderActionHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const requestContext = c.get('requestContext');
    const logger = mastra.getLogger();
    const actionId = c.req.param('actionId');
    const runId = c.req.query('runId');
    const { step, resumeData, tracingOptions } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume stream' });
    }

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          disableHotReload();
          const result = await getOriginalResumeStreamAgentBuilderActionHandler({
            mastra,
            actionId,
            runId,
            requestContext,
            body: { step, resumeData },
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
          logger.error('Error in resume stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
        enableHotReload();
      },
      async err => {
        logger.error('Error in resume stream: ' + err?.message);
      },
    );
  } catch (error) {
    enableHotReload();
    return handleError(error, 'Error resuming stream for agent builder action');
  }
}
