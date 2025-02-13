import type { Mastra } from '@mastra/core';
import type { Context } from 'hono';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

import { handleError } from './error';

export async function getWorkflowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflows = mastra.getWorkflows({ serialized: true });
    return c.json(workflows);
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
    const mastra = c.get('mastra');
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
