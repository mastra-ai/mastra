import type { Mastra } from '@mastra/core';
import {
  getWorkflowsHandler as getOriginalWorkflowsHandler,
  getWorkflowByIdHandler as getOriginalWorkflowByIdHandler,
  startAsyncWorkflowHandler as getOriginalStartAsyncWorkflowHandler,
  createRunHandler as getOriginalCreateRunHandler,
  startWorkflowRunHandler as getOriginalStartWorkflowRunHandler,
  watchWorkflowHandler as getOriginalWatchWorkflowHandler,
  resumeAsyncWorkflowHandler as getOriginalResumeAsyncWorkflowHandler,
  resumeWorkflowHandler as getOriginalResumeWorkflowHandler,
} from '@mastra/server/handlers/workflows';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { stream } from 'hono/streaming';

import { handleError } from './error';

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

export async function startAsyncWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const triggerData = await c.req.json();
    const runId = c.req.query('runId');

    const result = await getOriginalStartAsyncWorkflowHandler({
      mastra,
      workflowId,
      runId,
      triggerData,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error executing workflow');
  }
}

export async function createRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const prevRunId = c.req.query('runId');

    const result = await getOriginalCreateRunHandler({
      mastra,
      workflowId,
      runId: prevRunId,
    });

    return c.json(result);
  } catch (e) {
    return handleError(e, 'Error creating run');
  }
}

export async function startWorkflowRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const triggerData = await c.req.json();
    const runId = c.req.query('runId');

    await getOriginalStartWorkflowRunHandler({
      mastra,
      workflowId,
      runId,
      triggerData,
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

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalWatchWorkflowHandler({
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

export async function resumeAsyncWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');
    const { stepId, context } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const result = await getOriginalResumeAsyncWorkflowHandler({
      mastra,
      workflowId,
      runId,
      body: { stepId, context },
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error resuming workflow step');
  }
}

export async function resumeWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');
    const { stepId, context } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    await getOriginalResumeWorkflowHandler({
      mastra,
      workflowId,
      runId,
      body: { stepId, context },
    });

    return c.json({ message: 'Workflow run resumed' });
  } catch (error) {
    return handleError(error, 'Error resuming workflow');
  }
}
