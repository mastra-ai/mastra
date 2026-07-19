import {
  createUIMessageStream as createUIMessageStreamV5,
  createUIMessageStreamResponse as createUIMessageStreamResponseV5,
} from '@internal/ai-sdk-v5';
import type { UIMessageStreamOptions as UIMessageStreamOptionsV5 } from '@internal/ai-sdk-v5';
import {
  createUIMessageStream as createUIMessageStreamV6,
  createUIMessageStreamResponse as createUIMessageStreamResponseV6,
  isToolUIPart,
} from '@internal/ai-v6';
import type { UIMessageStreamOptions as UIMessageStreamOptionsV6 } from '@internal/ai-v6';
import type { AgentExecutionOptions, AgentExecutionOptionsBase } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import { toAISdkStream } from './convert-streams';
import { APPROVAL_ID_SEPARATOR } from './helpers';
import type {
  SupportedUIMessage,
  V5UIMessage,
  V5UIMessageStream,
  V6UIMessage,
  V6UIMessageStream,
} from './public-types';
import type { MastraStreamTransformOptions } from './smooth-stream';

export interface V6NativeApprovalResponse {
  resumeData: Record<string, unknown>;
  runId: string;
  toolCallId: string;
}

/**
 * Collects every approval response across all assistant messages in a v6
 * request. Responses are deduplicated by their composite run/tool-call target,
 * with the most recent part winning when history contains repeated copies.
 */
export function extractV6NativeApprovals(messages: V6UIMessage[]): V6NativeApprovalResponse[] {
  const byTarget = new Map<string, V6NativeApprovalResponse>();
  const separator = APPROVAL_ID_SEPARATOR;

  for (const message of messages) {
    if (message.role !== 'assistant') continue;

    for (const part of message.parts ?? []) {
      if (!isToolUIPart(part) || part.state !== 'approval-responded') continue;

      const lastSep = part.approval.id.lastIndexOf(separator);
      if (lastSep === -1) continue;
      const runId = part.approval.id.slice(0, lastSep);
      const toolCallId = part.approval.id.slice(lastSep + separator.length);
      if (!runId || !toolCallId) continue;
      // The composite approval id embeds the same toolCallId the part carries.
      // A mismatch means the part is malformed or stale, so skip it rather
      // than resume a tool call the user never answered.
      if (toolCallId !== part.toolCallId) continue;

      byTarget.set(`${runId}${separator}${toolCallId}`, {
        resumeData: {
          approved: part.approval.approved,
          ...(part.approval.reason != null ? { reason: part.approval.reason } : {}),
        },
        runId,
        toolCallId,
      });
    }
  }

  return [...byTarget.values()];
}

/** Streams exact approval targets sequentially as one v6 UI-message response. */
function streamV6ApprovalResumes(args: {
  agent: { resumeStream: (resumeData: unknown, options: unknown) => Promise<unknown> };
  approvals: V6NativeApprovalResponse[];
  baseOptions: Record<string, unknown>;
  structuredOutput?: unknown;
  messages: V6UIMessage[];
  lastMessageId?: string;
  sendStart: boolean;
  sendFinish: boolean;
  sendReasoning: boolean;
  sendSources: boolean;
  onError?: (error: unknown) => string;
  messageMetadata?: UIMessageStreamOptionsV6<V6UIMessage>['messageMetadata'];
  experimentalTransform?: MastraStreamTransformOptions<any>;
}): ReadableStream<any> {
  const { agent, approvals, baseOptions, structuredOutput, messages, lastMessageId } = args;
  const { sendStart, sendFinish, sendReasoning, sendSources, onError, messageMetadata, experimentalTransform } = args;

  return createUIMessageStreamV6<any>({
    originalMessages: messages,
    onError,
    execute: async ({ writer }) => {
      let startWritten = false;
      let successfulLegs = 0;
      let firstResolvedTargetError: unknown;
      let finalFinish: any;

      for (const approval of approvals) {
        try {
          const result = await agent.resumeStream(approval.resumeData, {
            ...baseOptions,
            runId: approval.runId,
            toolCallId: approval.toolCallId,
            ...(structuredOutput ? { structuredOutput } : {}),
          });

          for await (const part of toAISdkStream(result as Parameters<typeof toAISdkStream>[0], {
            from: 'agent',
            version: 'v6',
            lastMessageId,
            sendStart,
            sendFinish,
            sendReasoning,
            sendSources,
            experimentalTransform,
            onError,
            messageMetadata,
          })) {
            if (part.type === 'start') {
              if (startWritten) continue;
              startWritten = true;
              writer.write(part);
              continue;
            }
            // Resume streams can emit tool continuation chunks before their
            // start chunk. Frame the combined response before forwarding any
            // such content, then suppress the late duplicate start.
            if (!startWritten && sendStart) {
              writer.write({ type: 'start', ...(lastMessageId ? { messageId: lastMessageId } : {}) } as any);
              startWritten = true;
            }
            // Hold each leg's finish until all candidates have been attempted,
            // then emit only the final successful leg's metadata.
            if (part.type === 'finish') {
              finalFinish = part;
              continue;
            }
            writer.write(part);
          }
          successfulLegs++;
        } catch (error) {
          const id = (error as { id?: string } | undefined)?.id;
          if (id !== 'AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED' && id !== 'AGENT_RESUME_NO_SNAPSHOT_FOUND') {
            throw error;
          }
          firstResolvedTargetError ??= error;
        }
      }

      // Re-sent history may contain already-resolved responses alongside a new
      // one. Skip only core's exact "not suspended" errors; if none of the
      // targets resumed, surface the typed error instead of silently dropping
      // a potentially valid approval.
      if (successfulLegs === 0 && firstResolvedTargetError) throw firstResolvedTargetError;

      if (!startWritten && sendStart) {
        writer.write({ type: 'start', ...(lastMessageId ? { messageId: lastMessageId } : {}) } as any);
      }
      if (sendFinish) {
        writer.write(finalFinish ?? ({ type: 'finish' } as any));
      }
    },
  }) as ReadableStream<any>;
}

export type ChatStreamHandlerParams<
  UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage,
  OUTPUT = undefined,
> = AgentExecutionOptions<OUTPUT> & {
  messages: UI_MESSAGE[];
  resumeData?: Record<string, any>;
  /** The trigger for the request - sent by AI SDK's useChat hook */
  trigger?: 'submit-message' | 'regenerate-message';
};

export type ChatStreamDefaultOptions<OUTPUT = undefined> = AgentExecutionOptions<OUTPUT> & {
  /** Experimental transforms applied before converting Mastra chunks to AI SDK UI chunks. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
};

/**
 * Extracted from the second parameter of `Mastra.getAgentById` so the type
 * stays in sync with core automatically.
 */
export type AgentVersionOptions = NonNullable<Parameters<Mastra['getAgentById']>[1]>;

export type ChatStreamHandlerOptions<UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage, OUTPUT = undefined> = {
  mastra: Mastra;
  agentId: string;
  agentVersion?: AgentVersionOptions;
  params: ChatStreamHandlerParams<UI_MESSAGE, OUTPUT>;
  defaultOptions?: ChatStreamDefaultOptions<OUTPUT>;
  /** Experimental transforms applied before converting Mastra chunks to AI SDK UI chunks. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
  version?: 'v5' | 'v6';
  sendStart?: boolean;
  sendFinish?: boolean;
  sendReasoning?: boolean;
  sendSources?: boolean;
  onError?: (error: unknown) => string;
  messageMetadata?: UI_MESSAGE extends V6UIMessage
    ? UIMessageStreamOptionsV6<UI_MESSAGE>['messageMetadata']
    : UI_MESSAGE extends V5UIMessage
      ? UIMessageStreamOptionsV5<UI_MESSAGE>['messageMetadata']
      : never;
};

type ChatStreamHandlerOptionsV5<UI_MESSAGE extends V5UIMessage = V5UIMessage, OUTPUT = undefined> = Omit<
  ChatStreamHandlerOptions<UI_MESSAGE, OUTPUT>,
  'version' | 'messageMetadata'
> & {
  version?: 'v5';
  messageMetadata?: UIMessageStreamOptionsV5<UI_MESSAGE>['messageMetadata'];
};

type ChatStreamHandlerOptionsV6<UI_MESSAGE extends V6UIMessage = V6UIMessage, OUTPUT = undefined> = Omit<
  ChatStreamHandlerOptions<UI_MESSAGE, OUTPUT>,
  'version' | 'messageMetadata'
> & {
  version: 'v6';
  messageMetadata?: UIMessageStreamOptionsV6<UI_MESSAGE>['messageMetadata'];
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
export function handleChatStream<UI_MESSAGE extends V5UIMessage = V5UIMessage, OUTPUT = undefined>(
  options: ChatStreamHandlerOptionsV5<UI_MESSAGE, OUTPUT>,
): Promise<V5UIMessageStream<UI_MESSAGE>>;
export function handleChatStream<UI_MESSAGE extends V6UIMessage = V6UIMessage, OUTPUT = undefined>(
  options: ChatStreamHandlerOptionsV6<UI_MESSAGE, OUTPUT>,
): Promise<V6UIMessageStream<UI_MESSAGE>>;
export async function handleChatStream<OUTPUT = undefined>({
  mastra,
  agentId,
  agentVersion,
  params,
  defaultOptions,
  experimentalTransform,
  version = 'v5',
  sendStart = true,
  sendFinish = true,
  sendReasoning = false,
  sendSources = false,
  onError,
  messageMetadata,
}: ChatStreamHandlerOptions<any, OUTPUT>): Promise<ReadableStream<any>> {
  const { messages, resumeData, runId, requestContext, trigger, ...rest } = params;

  if (resumeData && !runId) {
    throw new Error('runId is required when resumeData is provided');
  }

  const baseAgent = mastra.getAgentById(agentId);
  if (!baseAgent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  // When an editor is configured, an agent's runtime config (instructions, tools,
  // model, ...) can live in stored config rather than the code definition. Studio
  // resolves these stored overrides before every run, so this endpoint must do the
  // same or it would execute a stale/empty code-defined agent (issue #18574). An
  // explicit agentVersion (from query params or route options) wins; otherwise we
  // default to the published version, matching the built-in agent handlers.
  let agentObj = baseAgent;
  const editorAgent = mastra.getEditor?.()?.agent;
  if (editorAgent) {
    agentObj = await editorAgent.applyStoredOverrides(
      baseAgent,
      agentVersion ?? { status: 'published' },
      requestContext as RequestContext | undefined,
    );
  } else if (agentVersion) {
    // No editor configured: preserve the prior behavior of surfacing the
    // "editor required for versioned agent lookup" error for explicit versions.
    agentObj = await mastra.getAgentById(agentId, agentVersion);
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

  const { structuredOutput: restStructuredOutput, ...restOptions } = rest;
  const {
    structuredOutput: defaultStructuredOutput,
    experimentalTransform: defaultExperimentalTransform,
    ...defaultOptionsRest
  } = defaultOptions ?? {};
  const structuredOutput = restStructuredOutput ?? defaultStructuredOutput;
  const effectiveExperimentalTransform = experimentalTransform ?? defaultExperimentalTransform;

  const mergedProviderOptions = {
    ...defaultOptions?.providerOptions,
    ...restOptions.providerOptions,
  };

  const baseOptions = {
    ...defaultOptionsRest,
    ...restOptions,
    ...(runId && { runId }),
    requestContext: requestContext || defaultOptions?.requestContext,
    ...(Object.keys(mergedProviderOptions).length > 0 && { providerOptions: mergedProviderOptions }),
  };

  // AI SDK v6 re-submits approval responses on assistant tool parts. Scan the
  // whole request because the answered card may be on an earlier assistant
  // message, then resume every exact run/tool-call target in request order.
  // A trailing user message remains a normal chat turn; consuming it as an
  // approval resume would silently drop the user's new request.
  if (version === 'v6' && !resumeData && trigger !== 'regenerate-message' && messages.at(-1)?.role === 'assistant') {
    const approvals = extractV6NativeApprovals(messages as V6UIMessage[]);
    if (approvals.length > 0) {
      return streamV6ApprovalResumes({
        agent: agentObj as unknown as Parameters<typeof streamV6ApprovalResumes>[0]['agent'],
        approvals,
        baseOptions,
        structuredOutput,
        messages: messages as V6UIMessage[],
        lastMessageId,
        sendStart,
        sendFinish,
        sendReasoning,
        sendSources,
        onError,
        experimentalTransform: effectiveExperimentalTransform,
        messageMetadata: messageMetadata as UIMessageStreamOptionsV6<V6UIMessage>['messageMetadata'],
      });
    }
  }

  const result = resumeData
    ? structuredOutput
      ? await agentObj.resumeStream(resumeData, { ...baseOptions, structuredOutput })
      : await agentObj.resumeStream(resumeData, baseOptions as AgentExecutionOptionsBase<unknown>)
    : structuredOutput
      ? await agentObj.stream(messagesToSend, { ...baseOptions, structuredOutput })
      : await agentObj.stream(messagesToSend, baseOptions as AgentExecutionOptionsBase<unknown>);

  if (version === 'v6') {
    return createUIMessageStreamV6<any>({
      originalMessages: messages,
      execute: async ({ writer }) => {
        for await (const part of toAISdkStream(result, {
          from: 'agent',
          version: 'v6',
          lastMessageId,
          sendStart,
          sendFinish,
          sendReasoning,
          sendSources,
          experimentalTransform: effectiveExperimentalTransform,
          onError,
          messageMetadata: messageMetadata as UIMessageStreamOptionsV6<V6UIMessage>['messageMetadata'],
        })) {
          writer.write(part);
        }
      },
    }) as ReadableStream<any>;
  }

  return createUIMessageStreamV5<any>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      for await (const part of toAISdkStream(result, {
        from: 'agent',
        lastMessageId,
        sendStart,
        sendFinish,
        sendReasoning,
        sendSources,
        experimentalTransform: effectiveExperimentalTransform,
        onError,
        messageMetadata: messageMetadata as UIMessageStreamOptionsV5<V5UIMessage>['messageMetadata'],
      })) {
        writer.write(part);
      }
    },
  }) as ReadableStream<any>;
}

export type chatRouteOptions<OUTPUT = undefined> = {
  defaultOptions?: ChatStreamDefaultOptions<OUTPUT>;
  /** Experimental transforms applied before converting Mastra chunks to AI SDK UI chunks. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
  version?: 'v5' | 'v6';
  agentVersion?: AgentVersionOptions;
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
    onError?: (error: unknown) => string;
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
 * @param {(error: unknown) => string} [options.onError] - Custom error serializer streamed to the client. When omitted, errors are passed through a default serializer that strips sensitive fields (e.g. `APICallError.requestBodyValues`, which holds the system prompt) before they reach the client.
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
  experimentalTransform,
  version = 'v5',
  agentVersion,
  sendStart = true,
  sendFinish = true,
  sendReasoning = false,
  sendSources = false,
  onError,
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
        {
          name: 'versionId',
          in: 'query',
          required: false,
          description: 'Specific agent version ID to use. Mutually exclusive with status.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'status',
          in: 'query',
          required: false,
          description:
            'Which stored config version to resolve: draft (latest) or published (active version). Mutually exclusive with versionId.',
          schema: {
            type: 'string',
            enum: ['draft', 'published'],
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
      const params = (await c.req.json()) as ChatStreamHandlerParams<SupportedUIMessage, OUTPUT>;
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
          abortSignal: c.req.raw.signal,
        } as any,
        defaultOptions,
        experimentalTransform,
        sendStart,
        sendFinish,
        sendReasoning,
        sendSources,
        onError,
      };

      if (version === 'v6') {
        const uiMessageStream = await handleChatStream({
          ...handlerOptions,
          version: 'v6',
        });

        return createUIMessageStreamResponseV6({ stream: uiMessageStream });
      }

      const uiMessageStream = await handleChatStream(handlerOptions);
      return createUIMessageStreamResponseV5({ stream: uiMessageStream });
    },
  });
}
