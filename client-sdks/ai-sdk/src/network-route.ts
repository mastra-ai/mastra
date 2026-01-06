import type { AgentExecutionOptions } from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import type { OutputSchema } from '@mastra/core/stream';
import {
  NetworkOutputAccumulator,
  type NetworkStructuredOutput,
  type StructuredNetworkOutputOptions,
} from '@mastra/core/network';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import type { InferUIMessageChunk, UIMessage } from 'ai';
import { toAISdkV5Stream } from './convert-streams';

export type NetworkStreamHandlerParams<OUTPUT extends OutputSchema = undefined> = AgentExecutionOptions<OUTPUT> & {
  messages: MessageListInput;
};

export type NetworkStreamHandlerOptions<OUTPUT extends OutputSchema = undefined> = {
  mastra: Mastra;
  agentId: string;
  params: NetworkStreamHandlerParams<OUTPUT>;
  defaultOptions?: AgentExecutionOptions<OUTPUT>;
};

export type NetworkStructuredHandlerParams<OUTPUT extends OutputSchema = undefined> =
  NetworkStreamHandlerParams<OUTPUT> & {
    structuredOutputOptions?: StructuredNetworkOutputOptions;
  };

export type NetworkStructuredHandlerOptions<OUTPUT extends OutputSchema = undefined> = {
  mastra: Mastra;
  agentId: string;
  params: NetworkStructuredHandlerParams<OUTPUT>;
  defaultOptions?: AgentExecutionOptions<OUTPUT>;
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
export async function handleNetworkStream<UI_MESSAGE extends UIMessage, OUTPUT extends OutputSchema = undefined>({
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

  const result = await agentObj.network(messages, {
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

/**
 * Framework-agnostic handler for accumulating agent network execution into structured output.
 * Use this function to get a complete structured representation of network execution.
 *
 * @example
 * ```ts
 * // Next.js App Router
 * import { handleNetworkStructuredOutput } from '@mastra/ai-sdk';
 * import { mastra } from '@/src/mastra';
 *
 * export async function POST(req: Request) {
 *   const params = await req.json();
 *   const structuredOutput = await handleNetworkStructuredOutput({
 *     mastra,
 *     agentId: 'routingAgent',
 *     params,
 *   });
 *   return Response.json(structuredOutput);
 * }
 * ```
 */
export async function handleNetworkStructuredOutput<OUTPUT extends OutputSchema = undefined>({
  mastra,
  agentId,
  params,
  defaultOptions,
}: NetworkStructuredHandlerOptions<OUTPUT>): Promise<NetworkStructuredOutput> {
  const { messages, structuredOutputOptions, ...rest } = params;

  const agentObj = mastra.getAgentById(agentId);

  if (!agentObj) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const result = await agentObj.network(messages, {
    ...defaultOptions,
    ...rest,
  });

  const accumulator = new NetworkOutputAccumulator(structuredOutputOptions);

  for await (const chunk of result) {
    accumulator.processChunk(chunk);
  }

  return accumulator.getStructuredOutput();
}

export type NetworkRouteOptions<OUTPUT extends OutputSchema = undefined> = (
  | { path: `${string}:agentId${string}`; agent?: never; defaultOptions?: AgentExecutionOptions<OUTPUT> }
  | { path: string; agent: string; defaultOptions?: AgentExecutionOptions<OUTPUT> }
) & {
  /**
   * Enable structured output endpoint at `/structuredOutput` variant of this route
   * @default false
   */
  structuredOutput?: boolean;
  /**
   * Options for configuring structured output behavior
   */
  structuredOutputOptions?: StructuredNetworkOutputOptions;
};

/**
 * Creates a network route handler for streaming agent network execution using the AI SDK-compatible format.
 *
 * This function registers an HTTP POST endpoint that accepts messages, executes an agent network, and streams the response back to the client in AI SDK-compatible format. Agent networks allow a routing agent to delegate tasks to other agents.
 *
 * @param {NetworkRouteOptions} options - Configuration options for the network route
 * @param {string} [options.path='/network/:agentId'] - The route path. Include `:agentId` for dynamic routing
 * @param {string} [options.agent] - Fixed agent ID when not using dynamic routing
 * @param {AgentExecutionOptions} [options.defaultOptions] - Default options passed to agent execution
 * @param {boolean} [options.structuredOutput=false] - Enable structured output endpoint
 * @param {StructuredNetworkOutputOptions} [options.structuredOutputOptions] - Options for structured output
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
 *
 * @example
 * // With structured output endpoint
 * networkRoute({
 *   path: '/network/:agentId',
 *   structuredOutput: true,
 *   structuredOutputOptions: {
 *     includeSteps: true,
 *     includeToolCalls: true,
 *   },
 * });
 */
export function networkRoute<OUTPUT extends OutputSchema = undefined>({
  path = '/network/:agentId',
  agent,
  defaultOptions,
  structuredOutput = false,
  structuredOutputOptions = {},
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
                structuredOutputOptions: { type: 'object', additionalProperties: true },
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
        },
        defaultOptions,
      });

      return createUIMessageStreamResponse({ stream: uiMessageStream });
    },
  });
}
