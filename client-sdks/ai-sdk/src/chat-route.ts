import type { AgentExecutionOptions } from '@mastra/core/agent';

import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import type { InferUIMessageChunk, UIMessage } from 'ai';
import { toAISdkV5Stream } from './convert-streams';

export type ChatStreamHandlerParams<
  UI_MESSAGE extends UIMessage,
  OUTPUT = undefined,
> = AgentExecutionOptions<OUTPUT> & {
  messages: UI_MESSAGE[];
  resumeData?: Record<string, any>;
  /** The trigger for the request - sent by AI SDK's useChat hook */
  trigger?: 'submit-message' | 'regenerate-message';
};

export type ChatStreamHandlerOptions<UI_MESSAGE extends UIMessage, OUTPUT = undefined> = {
  mastra: Mastra;
  agentId: string;
  params: ChatStreamHandlerParams<UI_MESSAGE, OUTPUT>;
  defaultOptions?: AgentExecutionOptions<OUTPUT>;
  sendStart?: boolean;
  sendFinish?: boolean;
  sendReasoning?: boolean;
  sendSources?: boolean;
};

/**
 * Framework-agnostic handler for streaming agent chat in AI SDK-compatible format.
 * Use this function directly when you need to handle chat streaming outside of Hono or Mastra's own apiRoutes feature.
 *
 * @example
 * ```ts
 * // Next.js App Router
 * import { handleChatStream } from '@mastra/ai-sdk';
 * import { createUIMessageStreamResponse } from 'ai';
 * import { mastra } from '@/src/mastra';
 *
 * export async function POST(req: Request) {
 *   const params = await req.json();
 *   const stream = await handleChatStream({
 *     mastra,
 *     agentId: 'weatherAgent',
 *     params,
 *   });
 *   return createUIMessageStreamResponse({ stream });
 * }
 * ```
 */
export async function handleChatStream<UI_MESSAGE extends UIMessage, OUTPUT = undefined>({
  mastra,
  agentId,
  params,
  defaultOptions,
  sendStart = true,
  sendFinish = true,
  sendReasoning = false,
  sendSources = false,
}: ChatStreamHandlerOptions<UI_MESSAGE, OUTPUT>): Promise<ReadableStream<InferUIMessageChunk<UI_MESSAGE>>> {
  const { messages, resumeData, runId, requestContext, trigger, ...rest } = params;

  if (resumeData && !runId) {
    throw new Error('runId is required when resumeData is provided');
  }

  const agentObj = mastra.getAgentById(agentId);
  if (!agentObj) {
    throw new Error(`Agent ${agentId} not found`);
  }

  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array of UIMessage objects');
  }

  // Capture the last assistant message ID for the stream response.
  // This helps the frontend identify which message the response corresponds to.
  let lastMessageId: string | undefined;
  let messagesToSend = messages;

  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1]!;
    if (lastMessage?.role === 'assistant') {
      lastMessageId = lastMessage.id;

      // For regeneration, remove the last assistant message so the LLM generates fresh text
      if (trigger === 'regenerate-message') {
        messagesToSend = messages.slice(0, -1);
      }
    }
  }

  const mergedOptions = {
    ...defaultOptions,
    ...rest,
    ...(runId && { runId }),
    requestContext: requestContext || defaultOptions?.requestContext,
  };

  const result = resumeData
    ? await agentObj.resumeStream<OUTPUT>(resumeData, mergedOptions)
    : await agentObj.stream<OUTPUT>(messagesToSend, mergedOptions);

  return createUIMessageStream<UI_MESSAGE>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      for await (const part of toAISdkV5Stream(result, {
        from: 'agent',
        lastMessageId,
        sendStart,
        sendFinish,
        sendReasoning,
        sendSources,
      })!) {
        writer.write(part as InferUIMessageChunk<UI_MESSAGE>);
      }
    },
  });
}

export type chatRouteOptions<OUTPUT = undefined> = {
  defaultOptions?: AgentExecutionOptions<OUTPUT>;
} & (
  | {
      path: `${string}:agentId${string}`;
      agent?: never;
    }
  | {
      path: string;
      agent: string;
    }
) & {
    sendStart?: boolean;
    sendFinish?: boolean;
    sendReasoning?: boolean;
    sendSources?: boolean;
  };

/**
 * Creates a chat route handler for streaming agent conversations using the AI SDK format.
 *
 * This function registers an HTTP POST endpoint that accepts messages, executes an agent, and streams the response back to the client in AI SDK-compatible format.
 *
 * @param {chatRouteOptions} options - Configuration options for the chat route
 * @param {string} [options.path='/chat/:agentId'] - The route path. Include `:agentId` for dynamic routing
 * @param {string} [options.agent] - Fixed agent ID when not using dynamic routing
 * @param {AgentExecutionOptions} [options.defaultOptions] - Default options passed to agent execution
 * @param {boolean} [options.sendStart=true] - Whether to send start events in the stream
 * @param {boolean} [options.sendFinish=true] - Whether to send finish events in the stream
 * @param {boolean} [options.sendReasoning=false] - Whether to include reasoning steps in the stream
 * @param {boolean} [options.sendSources=false] - Whether to include source citations in the stream
 *
 * @returns {ReturnType<typeof registerApiRoute>} A registered API route handler
 *
 * @throws {Error} When path doesn't include `:agentId` and no fixed agent is specified
 * @throws {Error} When agent ID is missing at runtime
 * @throws {Error} When specified agent is not found in Mastra instance
 *
 * @example
 * // Dynamic agent routing
 * chatRoute({
 *   path: '/chat/:agentId',
 * });
 *
 * @example
 * // Fixed agent with custom path
 * chatRoute({
 *   path: '/api/support-chat',
 *   agent: 'support-agent',
 *   defaultOptions: {
 *     maxSteps: 5,
 *   },
 * });
 *
 * @remarks
 * - The route handler expects a JSON body with a `messages` array
 * - Messages should follow the format: `{ role: 'user' | 'assistant' | 'system', content: string }`
 * - The response is a Server-Sent Events (SSE) stream compatible with AI SDK v5
 * - If both `agent` and `:agentId` are present, a warning is logged and the fixed `agent` takes precedence
 * - Request context from the incoming request overrides `defaultOptions.requestContext` if both are present
 */
export function chatRoute<OUTPUT = undefined>({
  path = '/chat/:agentId',
  agent,
  defaultOptions,
  sendStart = true,
  sendFinish = true,
  sendReasoning = false,
  sendSources = false,
}: chatRouteOptions<OUTPUT>): ReturnType<typeof registerApiRoute> {
  if (!agent && !path.includes('/:agentId')) {
    throw new Error('Path must include :agentId to route to the correct agent or pass the agent explicitly');
  }

  return registerApiRoute(path, {
    method: 'POST',
    openapi: {
      summary: 'Chat with an agent',
      description: 'Send messages to an agent and stream the response in the AI SDK format',
      tags: ['ai-sdk'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          description: 'The ID of the agent to chat with',
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                resumeData: {
                  type: 'object',
                  description: 'Resume data for the agent',
                },
                runId: {
                  type: 'string',
                  description: 'The run ID required when resuming an agent execution',
                },
                messages: {
                  type: 'array',
                  description: 'Array of messages in the conversation',
                  items: {
                    type: 'object',
                    properties: {
                      role: {
                        type: 'string',
                        enum: ['user', 'assistant', 'system'],
                        description: 'The role of the message sender',
                      },
                      content: {
                        type: 'string',
                        description: 'The content of the message',
                      },
                    },
                    required: ['role', 'content'],
                  },
                },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Streaming response from the agent',
          content: {
            'text/plain': {
              schema: {
                type: 'string',
                description: 'Server-sent events stream containing the agent response',
              },
            },
          },
        },
        '400': {
          description: 'Bad request - invalid input',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        '404': {
          description: 'Agent not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    },
    handler: async c => {
      const params = (await c.req.json()) as ChatStreamHandlerParams<UIMessage, OUTPUT>;
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

      const uiMessageStream = await handleChatStream<UIMessage, OUTPUT>({
        mastra,
        agentId: agentToUse,
        params: {
          ...params,
          requestContext: effectiveRequestContext,
        } as any,
        defaultOptions,
        sendStart,
        sendFinish,
        sendReasoning,
        sendSources,
      });

      return createUIMessageStreamResponse({
        stream: uiMessageStream,
      });
    },
  });
}
