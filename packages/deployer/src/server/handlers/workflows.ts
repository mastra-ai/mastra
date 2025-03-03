import type { Mastra } from '@mastra/core';
import type { Context } from 'hono';
import { streamText } from 'hono/streaming';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

import { handleError } from './error';

export async function getWorkflowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflows = mastra.getWorkflows({ serialized: false });
    const _workflows = Object.entries(workflows).reduce<any>((acc, [key, workflow]) => {
      acc[key] = {
        name: workflow.name,
        stepGraph: workflow.stepGraph,
        stepSubscriberGraph: workflow.stepSubscriberGraph,
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
    });
  } catch (error) {
    return handleError(error, 'Error getting workflow');
  }
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

    return streamText(
      c,
      async stream => {
        // NOTE: looks like the UI is closing the watch request, so as long as that is the case
        // this promise doesn't need to be resolved or rejected
        return new Promise((_resolve, _reject) => {
          let unwatch: () => void = workflow.watch(({ activePaths, context }) => {
            void stream.write(JSON.stringify({ activePaths, context }) + '\x1E');
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
    const { stepId, runId, context } = await c.req.json();

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
