import type { AgentExecutionOptions, NetworkOptions } from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import type { InferUIMessageChunk, UIMessage } from 'ai';
import { toAISdkV5Stream } from './convert-streams';

export type NetworkStreamHandlerParams<OUTPUT = undefined> = AgentExecutionOptions<OUTPUT> & {
  messages: MessageListInput;
};

export type NetworkStreamHandlerOptions<OUTPUT = undefined> = {
  mastra: Mastra;
  agentId: string;
  params: NetworkStreamHandlerParams<OUTPUT>;
  defaultOptions?: NetworkOptions<OUTPUT>;
};

/**
 * Framework-agnostic handler for streaming agent network execution in AI SDK-compatible format.
 * Use this function directly when you need to handle network streaming outside of Hono or Mastra's own apiRoutes feature.
 *
 * @example
 * ```ts
 * // Next.js App Router
 * import { handleNetworkStream } from '@mastra/ai-sdk';
 * import { createUIMessageStreamResponse } from 'ai';
 * import { mastra } from '@/src/mastra';
 *
 * export async function POST(req: Request) {
 *   const params = await req.json();
 *   const stream = await handleNetworkStream({
 *     mastra,
 *     agentId: 'routingAgent',
 *     params,
 *   });
 *   return createUIMessageStreamResponse({ stream });
 * }
 * ```
 */
export async function handleNetworkStream<UI_MESSAGE extends UIMessage, OUTPUT = undefined>({
  mastra,
  agentId,
  params,
  defaultOptions,
}: NetworkStreamHandlerOptions<OUTPUT>): Promise<ReadableStream<InferUIMessageChunk<UI_MESSAGE>>> {
  const { messages, ...rest } = params;

  const agentObj = mastra.getAgentById(agentId);

  if (!agentObj) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const result = await agentObj.network<any>(messages, {
    ...defaultOptions,
    ...rest,
  });

  return createUIMessageStream<UI_MESSAGE>({
    execute: async ({ writer }) => {
      for await (const part of toAISdkV5Stream(result, { from: 'network' })) {
        writer.write(part as InferUIMessageChunk<UI_MESSAGE>);
      }
    },
  });
}

export type NetworkRouteOptions<OUTPUT = undefined> =
  | { path: `${string}:agentId${string}`; agent?: never; defaultOptions?: NetworkOptions<OUTPUT> }
  | { path: string; agent: string; defaultOptions?: NetworkOptions<OUTPUT> };

/**
 * Creates a network route handler for streaming agent network execution using the AI SDK-compatible format.
 *
 * This function registers an HTTP POST endpoint that accepts messages, executes an agent network, and streams the response back to the client in AI SDK-compatible format. Agent networks allow a routing agent to delegate tasks to other agents.
 *
 * @param {NetworkRouteOptions} options - Configuration options for the network route
 * @param {string} [options.path='/network/:agentId'] - The route path. Include `:agentId` for dynamic routing
 * @param {string} [options.agent] - Fixed agent ID when not using dynamic routing
 * @param {AgentExecutionOptions} [options.defaultOptions] - Default options passed to agent execution
 *
 * @example
 * // Dynamic agent routing
 * networkRoute({
 *   path: '/network/:agentId',
 * });
 *
 * @example
 * // Fixed agent with custom path
 * networkRoute({
 *   path: '/api/orchestrator',
 *   agent: 'router-agent',
 *   defaultOptions: {
 *     maxSteps: 10,
 *   },
 * });
 */
export function networkRoute<OUTPUT = undefined>({
  path = '/network/:agentId',
  agent,
  defaultOptions,
}: NetworkRouteOptions<OUTPUT>): ReturnType<typeof registerApiRoute> {
  if (!agent && !path.includes('/:agentId')) {
    throw new Error('Path must include :agentId to route to the correct agent or pass the agent explicitly');
  }

  return registerApiRoute(path, {
    method: 'POST',
    openapi: {
      summary: 'Execute an agent network and stream AI SDK events',
      description: 'Routes a request to an agent network and streams UIMessage chunks in AI SDK format',
      tags: ['ai-sdk'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          description: 'The ID of the routing agent to execute as a network',
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
                messages: { type: 'array', items: { type: 'object' } },
                requestContext: { type: 'object', additionalProperties: true },
                runId: { type: 'string' },
                maxSteps: { type: 'number' },
                threadId: { type: 'string' },
                resourceId: { type: 'string' },
                modelSettings: { type: 'object', additionalProperties: true },
                tools: { type: 'array', items: { type: 'object' } },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Streaming AI SDK UIMessage event stream for the agent network',
          content: { 'text/plain': { schema: { type: 'string', description: 'SSE stream' } } },
        },
        '404': {
          description: 'Agent not found',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { error: { type: 'string' } } },
            },
          },
        },
      },
    },
    handler: async c => {
      const params = (await c.req.json()) as NetworkStreamHandlerParams<OUTPUT>;
      const mastra = c.get('mastra');
      const contextRequestContext = (c as any).get('requestContext') as RequestContext | undefined;

      let agentToUse: string | undefined = agent;
      if (!agent) {
        const agentId = c.req.param('agentId');
        agentToUse = agentId;
      }

      if (c.req.param('agentId') && agent) {
        mastra
          .getLogger()
          ?.warn(
            `Fixed agent ID was set together with an agentId path parameter. This can lead to unexpected behavior.`,
          );
      }

      // Prioritize requestContext from middleware/route options over body
      const effectiveRequestContext = contextRequestContext || defaultOptions?.requestContext || params.requestContext;

      if (
        (contextRequestContext && defaultOptions?.requestContext) ||
        (contextRequestContext && params.requestContext) ||
        (defaultOptions?.requestContext && params.requestContext)
      ) {
        mastra
          .getLogger()
          ?.warn(`Multiple "requestContext" sources provided. Using priority: middleware > route options > body.`);
      }

      if (!agentToUse) {
        throw new Error('Agent ID is required');
      }

      const uiMessageStream = await handleNetworkStream<UIMessage, OUTPUT>({
        mastra,
        agentId: agentToUse,
        params: {
          ...params,
          requestContext: effectiveRequestContext,
        } as any,
        defaultOptions,
      });

      return createUIMessageStreamResponse({ stream: uiMessageStream });
    },
  });
}
