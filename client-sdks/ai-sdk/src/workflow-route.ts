import type { TracingOptions } from '@mastra/core/ai-tracing';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { registerApiRoute } from '@mastra/core/server';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { toAISdkFormat } from './to-ai-sdk-format';

type WorkflowRouteBody = {
  inputData?: Record<string, any>;
  runtimeContext?: RuntimeContext;
  tracingOptions?: TracingOptions;
};

export type WorkflowRouteOptions =
  | { path: `${string}:workflowId${string}`; workflow?: undefined }
  | { path: string; workflow: string };

export function workflowRoute({
  path = '/api/workflows/:workflowId/stream',
  workflow,
}: WorkflowRouteOptions): ReturnType<typeof registerApiRoute> {
  if (!workflow && !path.includes('/:workflowId')) {
    throw new Error('Path must include :workflowId to route to the correct workflow or pass the workflow explicitly');
  }

  return registerApiRoute(path, {
    method: 'POST',
    openapi: {
      summary: 'Stream a workflow in AI SDK format',
      description: 'Starts a workflow run and streams events as AI SDK UIMessage chunks',
      tags: ['ai-sdk'],
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          description: 'The ID of the workflow to stream',
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                inputData: { type: 'object', additionalProperties: true },
                runtimeContext: { type: 'object', additionalProperties: true },
                tracingOptions: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Workflow UIMessage event stream',
          content: {
            'text/plain': {
              schema: { type: 'string', description: 'SSE stream' },
            },
          },
        },
      },
    },
    handler: async c => {
      const { inputData, ...rest } = (await c.req.json()) as WorkflowRouteBody;
      const mastra = c.get('mastra');

      let workflowToUse: string | undefined = workflow;
      if (!workflow) {
        const workflowId = c.req.param('workflowId');
        workflowToUse = workflowId;
      }

      if (c.req.param('workflowId') && workflow) {
        mastra
          .getLogger()
          ?.warn(
            `Fixed workflow ID was set together with a workflowId path parameter. This can lead to unexpected behavior.`,
          );
      }
      if (!workflowToUse) {
        throw new Error('Workflow ID is required');
      }

      const workflowObj = mastra.getWorkflow(workflowToUse);
      if (!workflowObj) {
        throw new Error(`Workflow ${workflowToUse} not found`);
      }

      const run = await workflowObj.createRunAsync();
      const stream = run.streamVNext({ inputData, ...rest });

      const uiMessageStream = createUIMessageStream({
        execute: async ({ writer }) => {
          for await (const part of toAISdkFormat(stream, { from: 'workflow' })) {
            writer.write(part);
          }
        },
      });

      return createUIMessageStreamResponse({ stream: uiMessageStream });
    },
  });
}
