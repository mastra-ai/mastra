import type { Mastra } from '@mastra/core';
import {
  getVNextWorkflowsHandler as getOriginalVNextWorkflowsHandler,
  getVNextWorkflowByIdHandler as getOriginalVNextWorkflowByIdHandler,
  startAsyncVNextWorkflowHandler as getOriginalStartAsyncVNextWorkflowHandler,
  createVNextWorkflowRunHandler as getOriginalCreateVNextWorkflowRunHandler,
  startVNextWorkflowRunHandler as getOriginalStartVNextWorkflowRunHandler,
  watchVNextWorkflowHandler as getOriginalWatchVNextWorkflowHandler,
  resumeAsyncVNextWorkflowHandler as getOriginalResumeAsyncVNextWorkflowHandler,
  resumeVNextWorkflowHandler as getOriginalResumeVNextWorkflowHandler,
  getVNextWorkflowRunsHandler as getOriginalGetVNextWorkflowRunsHandler,
} from '@mastra/server/handlers/vNextWorkflows';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { stream } from 'hono/streaming';

import { handleError } from './error';

export async function getVNextWorkflowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');

    const workflows = await getOriginalVNextWorkflowsHandler({
      mastra,
    });

    return c.json(workflows);
  } catch (error) {
    return handleError(error, 'Error getting workflows');
  }
}

export async function getVNextWorkflowByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');

    const workflow = await getOriginalVNextWorkflowByIdHandler({
      mastra,
      workflowId,
    });

    return c.json(workflow);
  } catch (error) {
    return handleError(error, 'Error getting workflow');
  }
}

export async function createVNextWorkflowRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const prevRunId = c.req.query('runId');

    const result = await getOriginalCreateVNextWorkflowRunHandler({
      mastra,
      workflowId,
      runId: prevRunId,
    });

    return c.json(result);
  } catch (e) {
    return handleError(e, 'Error creating run');
  }
}

export async function startAsyncVNextWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const { inputData, runtimeContext } = await c.req.json();
    const runId = c.req.query('runId');

    const result = await getOriginalStartAsyncVNextWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      inputData,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error executing workflow');
  }
}

export async function startVNextWorkflowRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const { inputData, runtimeContext } = await c.req.json();
    const runId = c.req.query('runId');

    await getOriginalStartVNextWorkflowRunHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      inputData,
    });

    return c.json({ message: 'Workflow run started' });
  } catch (e) {
    return handleError(e, 'Error starting workflow run');
  }
}

export function watchVNextWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to watch workflow' });
    }

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalWatchVNextWorkflowHandler({
            mastra,
            workflowId,
            runId,
          });
          stream.onAbort(() => {
            if (!result.locked) {
              return result.cancel();
            }
          });

          for await (const chunk of result) {
            await stream.write(chunk.toString() + '\x1E');
          }
        } catch (err) {
          console.log(err);
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

export async function resumeAsyncVNextWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');
    const { step, resumeData, runtimeContext } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const result = await getOriginalResumeAsyncVNextWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      body: { step, resumeData },
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error resuming workflow step');
  }
}

export async function resumeVNextWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');
    const { step, resumeData, runtimeContext } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    await getOriginalResumeVNextWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      body: { step, resumeData },
    });

    return c.json({ message: 'Workflow run resumed' });
  } catch (error) {
    return handleError(error, 'Error resuming workflow');
  }
}

export async function getVNextWorkflowRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const { fromDate, toDate, limit, offset, resourceId } = c.req.query();
    const workflowRuns = await getOriginalGetVNextWorkflowRunsHandler({
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
