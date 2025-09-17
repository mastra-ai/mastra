import type { Mastra } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
  getLegacyWorkflowsHandler as getOriginalLegacyWorkflowsHandler,
  getLegacyWorkflowByIdHandler as getOriginalLegacyWorkflowByIdHandler,
  startAsyncLegacyWorkflowHandler as getOriginalStartAsyncLegacyWorkflowHandler,
  createLegacyWorkflowRunHandler as getOriginalCreateLegacyWorkflowRunHandler,
  startLegacyWorkflowRunHandler as getOriginalStartLegacyWorkflowRunHandler,
  watchLegacyWorkflowHandler as getOriginalWatchLegacyWorkflowHandler,
  resumeAsyncLegacyWorkflowHandler as getOriginalResumeAsyncLegacyWorkflowHandler,
  resumeLegacyWorkflowHandler as getOriginalResumeLegacyWorkflowHandler,
  getLegacyWorkflowRunsHandler as getOriginalGetLegacyWorkflowRunsHandler,
} from '@mastra/server/handlers/legacyWorkflows';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { stream } from 'hono/streaming';

import { handleError } from '../../error';

export async function getLegacyWorkflowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');

    const workflows = await getOriginalLegacyWorkflowsHandler({
      mastra,
    });

    return c.json(workflows);
  } catch (error) {
    return handleError(error, 'Error getting workflows');
  }
}

export async function getLegacyWorkflowByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');

    const workflow = await getOriginalLegacyWorkflowByIdHandler({
      mastra,
      workflowId,
    });

    return c.json(workflow);
  } catch (error) {
    return handleError(error, 'Error getting workflow');
  }
}

export async function startAsyncLegacyWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const workflowId = c.req.param('workflowId');
    const triggerData = await c.req.json();
    const runId = c.req.query('runId');

    const result = await getOriginalStartAsyncLegacyWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      triggerData,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error executing workflow');
  }
}

export async function createLegacyWorkflowRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const prevRunId = c.req.query('runId');

    const result = await getOriginalCreateLegacyWorkflowRunHandler({
      mastra,
      workflowId,
      runId: prevRunId,
    });

    return c.json(result);
  } catch (e) {
    return handleError(e, 'Error creating run');
  }
}

export async function startLegacyWorkflowRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const workflowId = c.req.param('workflowId');
    const triggerData = await c.req.json();
    const runId = c.req.query('runId');

    await getOriginalStartLegacyWorkflowRunHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      triggerData,
    });

    return c.json({ message: 'Workflow run started' });
  } catch (e) {
    return handleError(e, 'Error starting workflow run');
  }
}

export function watchLegacyWorkflowHandler(c: Context) {
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
          const result = await getOriginalWatchLegacyWorkflowHandler({
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
          console.error(err);
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

export async function resumeAsyncLegacyWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');
    const { stepId, context } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const result = await getOriginalResumeAsyncLegacyWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      body: { stepId, context },
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error resuming workflow step');
  }
}

export async function resumeLegacyWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const workflowId = c.req.param('workflowId');
    const runId = c.req.query('runId');
    const { stepId, context } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    await getOriginalResumeLegacyWorkflowHandler({
      mastra,
      runtimeContext,
      workflowId,
      runId,
      body: { stepId, context },
    });

    return c.json({ message: 'Workflow run resumed' });
  } catch (error) {
    return handleError(error, 'Error resuming workflow');
  }
}

export async function getLegacyWorkflowRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const { fromDate, toDate, limit, offset, resourceId } = c.req.query();
    const workflowRuns = await getOriginalGetLegacyWorkflowRunsHandler({
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
