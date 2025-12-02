import type { Mastra } from '@mastra/core/mastra';
import type { TracingOptions } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import type { InferUIMessageChunk, UIMessage } from 'ai';
import { toAISdkV5Stream } from './convert-streams';

export type WorkflowStreamHandlerParams = {
  runId?: string;
  resourceId?: string;
  inputData?: Record<string, any>;
  resumeData?: Record<string, any>;
  requestContext?: RequestContext;
  tracingOptions?: TracingOptions;
  step?: string;
};

export type WorkflowStreamHandlerOptions = {
  mastra: Mastra;
  workflowId: string;
  params: WorkflowStreamHandlerParams;
  includeTextStreamParts?: boolean;
};

/**
 * Framework-agnostic handler for streaming workflow execution in AI SDK format.
 * Use this function directly when you need to handle workflow streaming outside of Hono/registerApiRoute.
 *
 * @example
 * // Next.js App Router
 * export async function POST(req: Request) {
 *   const params = await req.json();
 *   return handleWorkflowStream({
 *     mastra,
 *     workflowId: 'my-workflow',
 *     params,
 *   });
 * }
 */
export async function handleWorkflowStream<UI_MESSAGE extends UIMessage>({
  mastra,
  workflowId,
  params,
  includeTextStreamParts = true,
}: WorkflowStreamHandlerOptions): Promise<ReadableStream<InferUIMessageChunk<UI_MESSAGE>>> {
  const { runId, resourceId, inputData, resumeData, requestContext, ...rest } = params;

  const workflowObj = mastra.getWorkflowById(workflowId);
  if (!workflowObj) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  const run = await workflowObj.createRun({ runId, resourceId, ...rest });

  const stream = resumeData
    ? run.resumeStream({ resumeData, ...rest, requestContext })
    : run.stream({ inputData, ...rest, requestContext });

  return createUIMessageStream<UI_MESSAGE>({
    execute: async ({ writer }) => {
      for await (const part of toAISdkV5Stream(stream, { from: 'workflow', includeTextStreamParts })) {
        writer.write(part as InferUIMessageChunk<UI_MESSAGE>);
      }
    },
  });
}

export type WorkflowRouteOptions =
  | { path: `${string}:workflowId${string}`; workflow?: never; includeTextStreamParts?: boolean }
  | { path: string; workflow: string; includeTextStreamParts?: boolean };

export function workflowRoute({
  path = '/api/workflows/:workflowId/stream',
  workflow,
  includeTextStreamParts = true,
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
                runId: { type: 'string' },
                resourceId: { type: 'string' },
                inputData: { type: 'object', additionalProperties: true },
                resumeData: { type: 'object', additionalProperties: true },
                requestContext: { type: 'object', additionalProperties: true },
                tracingOptions: { type: 'object', additionalProperties: true },
                step: { type: 'string' },
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
      const params = (await c.req.json()) as WorkflowStreamHandlerParams;
      const mastra = c.get('mastra');
      const contextRequestContext = (c as any).get('requestContext') as RequestContext | undefined;

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

      if (contextRequestContext && params.requestContext) {
        mastra
          .getLogger()
          ?.warn(
            `"requestContext" from the request body will be ignored because "requestContext" is already set in the route options.`,
          );
      }

      const uiMessageStream = await handleWorkflowStream({
        mastra,
        workflowId: workflowToUse,
        params: {
          ...params,
          requestContext: contextRequestContext || params.requestContext,
        },
        includeTextStreamParts,
      });

      return createUIMessageStreamResponse({ stream: uiMessageStream });
    },
  });
}
