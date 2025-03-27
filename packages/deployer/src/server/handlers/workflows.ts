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

export async function startAsyncWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const workflow = mastra.getWorkflow(workflowId);
    const body = await c.req.json();
    const runId = c.req.query('runId');

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to start run' });
    }

    const run = workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const result = await run.start({
      triggerData: body,
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
    const workflow = mastra.getWorkflow(workflowId);
    const prevRunId = c.req.query('runId');

    const { runId } = workflow.createRun({ runId: prevRunId });

    return c.json({ runId });
  } catch (e) {
    return handleError(e, 'Error creating run');
  }
}

export async function startWorkflowRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const workflow = mastra.getWorkflow(workflowId);
    const body = await c.req.json();
    const runId = c.req.query('runId');

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to start run' });
    }

    const run = workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    run.start({
      triggerData: body,
    });

    return c.json({ message: 'Workflow run started' });
  } catch (e) {
    return handleError(e, 'Error starting workflow run');
  }
}

export async function watchWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const workflowId = c.req.param('workflowId');
    const workflow = mastra.getWorkflow(workflowId);
    const runId = c.req.query('runId');

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to watch workflow' });
    }

    const run = workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    return streamText(
      c,
      async stream => {
        return new Promise((_resolve, _reject) => {
          let unwatch: () => void = run.watch(({ activePaths, runId, timestamp, results }) => {
            const activePathsObj = Object.fromEntries(activePaths);
            void stream.write(JSON.stringify({ activePaths: activePathsObj, runId, timestamp, results }) + '\x1E');
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

export async function resumeAsyncWorkflowHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const workflowId = c.req.param('workflowId');
    const workflow = mastra.getWorkflow(workflowId);
    const runId = c.req.query('runId');
    const { stepId, context } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const run = workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    const result = await run.resume({
      stepId,
      context,
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
    const workflow = mastra.getWorkflow(workflowId);
    const runId = c.req.query('runId');
    const { stepId, context } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume workflow' });
    }

    const run = workflow.getRun(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    run.resume({
      stepId,
      context,
    });

    return c.json({ message: 'Workflow run resumed' });
  } catch (error) {
    return handleError(error, 'Error resuming workflow');
  }
}
