import { createUIMessageStream, createUIMessageStreamResponse } from '@mastra/core/ai';
import type { Mastra } from '@mastra/core/mastra';
import type { TracingOptions } from '@mastra/core/observability';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import { toAISdkStream } from './convert-streams';
import type { UIMessage, UIMessageStream } from './public-types';

export type WorkflowStreamHandlerParams = {
  runId?: string;
  resourceId?: string;
  inputData?: Record<string, any>;
  initialState?: Record<string, any>;
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
  sendReasoning?: boolean;
  sendSources?: boolean;
};

/**
 * Framework-agnostic handler for streaming workflow execution in AI SDK-compatible format.
 * Use this function directly when you need to handle workflow streaming outside of Hono or Mastra's own apiRoutes feature.
 *
 * @example
 * ```ts
 * // Next.js App Router
 * import { handleWorkflowStream } from '@mastra/ai-sdk';
 * import { createUIMessageStreamResponse } from '@mastra/core/ai';
 * import { mastra } from '@/src/mastra';
 *
 * export async function POST(req: Request) {
 *   const params = await req.json();
 *   const stream = await handleWorkflowStream({
 *     mastra,
 *     workflowId: 'weatherWorkflow',
 *     params,
 *   });
 *   return createUIMessageStreamResponse({ stream });
 * }
 * ```
 */
export function handleWorkflowStream<UI_MESSAGE extends UIMessage = UIMessage>(
  options: WorkflowStreamHandlerOptions,
): Promise<UIMessageStream<UI_MESSAGE>>;
export async function handleWorkflowStream({
  mastra,
  workflowId,
  params,
  includeTextStreamParts = true,
  sendReasoning = false,
  sendSources = false,
}: WorkflowStreamHandlerOptions): Promise<UIMessageStream> {
  const {
    runId,
    resourceId: resourceIdFromParams,
    inputData,
    initialState,
    resumeData,
    requestContext,
    ...rest
  } = params;
  const resourceIdFromContext = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
  const resourceId = resourceIdFromContext ?? resourceIdFromParams;

  const workflowObj = mastra.getWorkflowById(workflowId);
  if (!workflowObj) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  const run = await workflowObj.createRun({ runId, resourceId, ...rest });

  const stream = resumeData
    ? run.resumeStream({ resumeData, ...rest, requestContext })
    : run.stream({ inputData, initialState, ...rest, requestContext });

  return createUIMessageStream<UIMessage>({
    execute: async ({ writer }) => {
      for await (const part of toAISdkStream(stream, {
        from: 'workflow',
        includeTextStreamParts,
        sendReasoning,
        sendSources,
      })) {
        writer.write(part);
      }
    },
  });
}

export type WorkflowRouteOptions = {
  sendReasoning?: boolean;
  sendSources?: boolean;
} & (
  | { path: `${string}:workflowId${string}`; workflow?: never; includeTextStreamParts?: boolean }
  | { path: string; workflow: string; includeTextStreamParts?: boolean }
);

/**
 * Creates a workflow route handler for streaming workflow execution using the AI SDK format.
 *
 * This function registers an HTTP POST endpoint that accepts input data, executes a workflow, and streams the response back to the client in AI SDK-compatible format.
 *
 * @param {WorkflowRouteOptions} options - Configuration options for the workflow route
 * @param {string} [options.path='/api/workflows/:workflowId/stream'] - The route path. Include `:workflowId` for dynamic routing
 * @param {string} [options.workflow] - Fixed workflow ID when not using dynamic routing
 * @param {boolean} [options.includeTextStreamParts=true] - Whether to include text stream parts in the output
 *
 * @example
 * // Dynamic workflow routing
 * workflowRoute({
 *   path: '/api/workflows/:workflowId/stream',
 * });
 *
 * @example
 * // Fixed workflow with custom path
 * workflowRoute({
 *   path: '/api/data-pipeline/stream',
 *   workflow: 'data-processing-workflow',
 * });
 */
export function workflowRoute({
  path = '/api/workflows/:workflowId/stream',
  workflow,
  includeTextStreamParts = true,
  sendReasoning = false,
  sendSources = false,
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

      const handlerOptions = {
        mastra,
        workflowId: workflowToUse,
        params: {
          ...params,
          requestContext: contextRequestContext || params.requestContext,
        },
        includeTextStreamParts,
        sendReasoning,
        sendSources,
      };

      const uiMessageStream = await handleWorkflowStream(handlerOptions);
      return createUIMessageStreamResponse({ stream: uiMessageStream });
    },
  });
}
