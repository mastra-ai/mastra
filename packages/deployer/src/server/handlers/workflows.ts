import type { Mastra } from '@mastra/core';
import type { Context } from 'hono';
import { streamText } from 'hono/streaming';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

import { handleError } from './error';
import { HTTPException } from 'hono/http-exception';

export async function getWorkflowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflows = mastra.getWorkflows({ serialized: false });
    const _workflows = Object.entries(workflows).reduce<any>((acc, [key, workflow]) => {
      acc[key] = {
        stepGraph: workflow.stepGraph,
        stepSubscriberGraph: workflow.stepSubscriberGraph,
        serializedStepGraph: workflow.serializedStepGraph,
        serializedStepSubscriberGraph: workflow.serializedStepSubscriberGraph,
        name: workflow.name,
        triggerSchema: workflow.triggerSchema ? stringify(zodToJsonSchema(workflow.triggerSchema)) : undefined,
        steps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
          const _step = step as any;
          acc[key] = {
            ..._step,
            inputSchema: _step.inputSchema ? stringify(zodToJsonSchema(_step.inputSchema)) : undefined,
            outputSchema: _step.outputSchema ? stringify(zodToJsonSchema(_step.outputSchema)) : undefined,
          };
          return acc;
        }, {}),
      };
      return acc;
    }, {});
    return c.json(_workflows);
  } catch (error) {
    return handleError(error, 'Error getting workflows');
  }
}

export async function getWorkflowByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const workflow = mastra.getWorkflow(workflowId);

    const triggerSchema = workflow?.triggerSchema;
    const stepGraph = workflow.stepGraph;
    const stepSubscriberGraph = workflow.stepSubscriberGraph;
    const serializedStepGraph = workflow.serializedStepGraph;
    const serializedStepSubscriberGraph = workflow.serializedStepSubscriberGraph;
    const serializedSteps = Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
      const _step = step as any;
      acc[key] = {
        ..._step,
        inputSchema: _step.inputSchema ? stringify(zodToJsonSchema(_step.inputSchema)) : undefined,
        outputSchema: _step.outputSchema ? stringify(zodToJsonSchema(_step.outputSchema)) : undefined,
      };
      return acc;
    }, {});

    return c.json({
      name: workflow.name,
      triggerSchema: triggerSchema ? stringify(zodToJsonSchema(triggerSchema)) : undefined,
      steps: serializedSteps,
      stepGraph,
      stepSubscriberGraph,
      serializedStepGraph,
      serializedStepSubscriberGraph,
    });
  } catch (error) {
    return handleError(error, 'Error getting workflow');
  }
}

export async function startWorkflowRunHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const workflowId = c.req.param('workflowId');
  const workflow = mastra.getWorkflow(workflowId);
  const body = await c.req.json();

  const { start, runId } = workflow.createRun();

  start({
    triggerData: body,
  });

  return c.json({ runId });
}

export async function executeWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const workflow = mastra.getWorkflow(workflowId);
    const body = await c.req.json();

    const { start } = workflow.createRun();

    const result = await start({
      triggerData: body,
    });
    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error executing workflow');
  }
}

export async function watchWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const workflowId = c.req.param('workflowId');
    const workflow = mastra.getWorkflow(workflowId);
    const queryRunId = c.req.query('runId');

    return streamText(
      c,
      async stream => {
        return new Promise((_resolve, _reject) => {
          let unwatch: () => void = workflow.watch(({ activePaths, context, runId, timestamp, suspendedSteps }) => {
            if (!queryRunId || runId === queryRunId) {
              void stream.write(JSON.stringify({ activePaths, context, runId, timestamp, suspendedSteps }) + '\x1E');
            }
          });

          stream.onAbort(() => {
            unwatch?.();
          });
        });
      },
      async (err, stream) => {
        logger.error('Error in watch stream: ' + err?.message);
        stream.abort();
        await stream.close();
      },
    );
  } catch (error) {
    return handleError(error, 'Error watching workflow');
  }
}

export async function resumeWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const workflow = mastra.getWorkflow(workflowId);
    const runId = c.req.query('runId');
    const { stepId, context } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const result = await workflow.resume({
      stepId,
      runId,
      context,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error resuming workflow step');
  }
}
