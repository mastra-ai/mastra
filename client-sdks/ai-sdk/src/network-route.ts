import {
  createUIMessageStream as createUIMessageStreamV5,
  createUIMessageStreamResponse as createUIMessageStreamResponseV5,
} from '@internal/ai-sdk-v5';
import type { UIMessage as InternalUIMessageV5 } from '@internal/ai-sdk-v5';
import {
  createUIMessageStream as createUIMessageStreamV6,
  createUIMessageStreamResponse as createUIMessageStreamResponseV6,
} from '@internal/ai-v6';
import type { UIMessage as InternalUIMessageV6 } from '@internal/ai-v6';
import type { AgentExecutionOptions, NetworkOptions } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import type { AgentVersionOptions } from './chat-route';
import { toAISdkStream } from './convert-streams';
import type {
  SupportedUIMessage,
  SupportedUIMessageStream,
  V5UIMessage,
  V5UIMessageStream,
  V6UIMessage,
  V6UIMessageStream,
} from './public-types';

export type NetworkStreamHandlerParams<
  UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage,
  OUTPUT = undefined,
> = AgentExecutionOptions<OUTPUT> & {
  messages: UI_MESSAGE[];
};

export type NetworkStreamHandlerOptions<
  UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage,
  OUTPUT = undefined,
> = {
  mastra: Mastra;
  agentId: string;
  agentVersion?: AgentVersionOptions;
  params: NetworkStreamHandlerParams<UI_MESSAGE, OUTPUT>;
  defaultOptions?: NetworkOptions<OUTPUT>;
  version?: 'v5' | 'v6';
};

type NetworkStreamHandlerOptionsV5<UI_MESSAGE extends V5UIMessage = V5UIMessage, OUTPUT = undefined> = Omit<
  NetworkStreamHandlerOptions<UI_MESSAGE, OUTPUT>,
  'version'
> & {
  version?: 'v5';
};

type NetworkStreamHandlerOptionsV6<UI_MESSAGE extends V6UIMessage = V6UIMessage, OUTPUT = undefined> = Omit<
  NetworkStreamHandlerOptions<UI_MESSAGE, OUTPUT>,
  'version'
> & {
  version: 'v6';
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
export function handleNetworkStream<UI_MESSAGE extends V5UIMessage = V5UIMessage, OUTPUT = undefined>(
  options: NetworkStreamHandlerOptionsV5<UI_MESSAGE, OUTPUT>,
): Promise<V5UIMessageStream<UI_MESSAGE>>;
export function handleNetworkStream<UI_MESSAGE extends V6UIMessage = V6UIMessage, OUTPUT = undefined>(
  options: NetworkStreamHandlerOptionsV6<UI_MESSAGE, OUTPUT>,
): Promise<V6UIMessageStream<UI_MESSAGE>>;
export async function handleNetworkStream<OUTPUT = undefined>({
  mastra,
  agentId,
  agentVersion,
  params,
  defaultOptions,
  version = 'v5',
}: NetworkStreamHandlerOptions<SupportedUIMessage, OUTPUT>): Promise<SupportedUIMessageStream> {
  const { messages, ...rest } = params;

  const agentObj = agentVersion ? await mastra.getAgentById(agentId, agentVersion) : mastra.getAgentById(agentId);

  if (!agentObj) {
    throw new Error(`Agent ${agentId} not found`);
  }

  if (version === 'v6') {
    const result = await agentObj.network<any>(messages as any, {
      ...defaultOptions,
      ...rest,
    });

    const stream = createUIMessageStreamV6<InternalUIMessageV6>({
      originalMessages: messages as InternalUIMessageV6[],
      execute: async ({ writer }) => {
        for await (const part of toAISdkStream(result, { from: 'network', version: 'v6' })) {
          writer.write(part);
        }
      },
    });

    return stream as unknown as SupportedUIMessageStream;
  }

  const result = await agentObj.network<any>(messages as any, {
    ...defaultOptions,
    ...rest,
  });

  const stream = createUIMessageStreamV5<InternalUIMessageV5>({
    originalMessages: messages as InternalUIMessageV5[],
    execute: async ({ writer }) => {
      for await (const part of toAISdkStream(result, { from: 'network' })) {
        writer.write(part);
      }
    },
  });

  return stream as unknown as SupportedUIMessageStream;
}

export type NetworkRouteOptions<OUTPUT = undefined> =
  | {
      path: `${string}:agentId${string}`;
      agent?: never;
      defaultOptions?: NetworkOptions<OUTPUT>;
      version?: 'v5' | 'v6';
      agentVersion?: AgentVersionOptions;
    }
  | {
      path: string;
      agent: string;
      defaultOptions?: NetworkOptions<OUTPUT>;
      version?: 'v5' | 'v6';
      agentVersion?: AgentVersionOptions;
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
  version = 'v5',
  agentVersion,
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
        {
          name: 'versionId',
          in: 'query',
          required: false,
          description: 'Specific agent version ID to use. Mutually exclusive with status.',
          schema: { type: 'string' },
        },
        {
          name: 'status',
          in: 'query',
          required: false,
          description:
            'Which stored config version to resolve: draft (latest) or published (active version). Mutually exclusive with versionId.',
          schema: { type: 'string', enum: ['draft', 'published'] },
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
        '400': {
          description: 'Bad request - invalid input',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { error: { type: 'string' } } },
            },
          },
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
      const params = (await c.req.json()) as NetworkStreamHandlerParams<SupportedUIMessage, OUTPUT>;
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

      // Resolve agent version from query params, falling back to static option
      const queryVersionId = c.req.query('versionId');
      const rawStatus = c.req.query('status');

      if (queryVersionId && rawStatus) {
        throw new Error('Query parameters "versionId" and "status" are mutually exclusive');
      }

      if (rawStatus && rawStatus !== 'draft' && rawStatus !== 'published') {
        throw new Error('Query parameter "status" must be "draft" or "published"');
      }

      const queryStatus = rawStatus as 'draft' | 'published' | undefined;
      const effectiveAgentVersion: AgentVersionOptions | undefined = queryVersionId
        ? { versionId: queryVersionId }
        : queryStatus
          ? { status: queryStatus }
          : agentVersion;

      const handlerOptions = {
        mastra,
        agentId: agentToUse,
        agentVersion: effectiveAgentVersion,
        params: {
          ...params,
          requestContext: effectiveRequestContext,
        } as any,
        defaultOptions,
      };

      if (version === 'v6') {
        const uiMessageStream = await handleNetworkStream({
          ...handlerOptions,
          version: 'v6',
        });

        return createUIMessageStreamResponseV6({ stream: uiMessageStream });
      }

      const uiMessageStream = await handleNetworkStream(handlerOptions);
      return createUIMessageStreamResponseV5({ stream: uiMessageStream });
    },
  });
}
