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
import {
  createUIMessageStream as createUIMessageStreamV7,
  createUIMessageStreamResponse as createUIMessageStreamResponseV7,
} from '@internal/ai-v7';
import type { UIMessageStreamOptions as UIMessageStreamOptionsV7 } from '@internal/ai-v7';
import type { AgentExecutionOptions, AgentExecutionOptionsBase } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { MastraMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import { toAISdkStream } from './convert-streams';
import { APPROVAL_ID_SEPARATOR } from './helpers';
import type {
  SupportedUIMessage,
  V5UIMessage,
  V5UIMessageStream,
  V6UIMessage,
  V6UIMessageStream,
  V7UIMessage,
  V7UIMessageStream,
  WithTraceId,
} from './public-types';
import type { MastraStreamTransformOptions } from './smooth-stream';
import { assertValidHeartbeatMs, withSseHeartbeat } from './sse-heartbeat';

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

/** Streams exact approval targets sequentially as one v6/v7 UI-message response. */
function streamV6ApprovalResumes(args: {
  version: 'v6' | 'v7';
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
  includeSubAgentMetadata: boolean;
  onError?: (error: unknown) => string;
  messageMetadata?: UIMessageStreamOptionsV6<V6UIMessage>['messageMetadata'];
  experimentalTransform?: MastraStreamTransformOptions<any>;
}): ReadableStream<any> {
  const { agent, approvals, baseOptions, structuredOutput, messages, lastMessageId } = args;
  const {
    sendStart,
    sendFinish,
    sendReasoning,
    sendSources,
    includeSubAgentMetadata,
    onError,
    messageMetadata,
    experimentalTransform,
  } = args;

  const createUIMessageStream = (
    args.version === 'v7' ? createUIMessageStreamV7 : createUIMessageStreamV6
  ) as typeof createUIMessageStreamV6;

  return createUIMessageStream<any>({
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
            includeSubAgentMetadata,
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
          if (
            id !== 'AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED' &&
            id !== 'AGENT_RESUME_NO_SNAPSHOT_FOUND' &&
            id !== 'AGENT_RESUME_ALREADY_CLAIMED'
          ) {
            throw error;
          }
          firstResolvedTargetError ??= error;
        }
      }

      // Re-sent history may contain already-resolved responses alongside a new
      // one, or a response another request is resuming right now. Skip only
      // core's exact "not suspended" and "already claimed" errors; if none of the
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

const CREDENTIAL_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'x-goog-api-key',
  'cookie',
]);

export type ChatStreamHandlerParams<
  UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage,
  OUTPUT = undefined,
> = AgentExecutionOptions<OUTPUT> & {
  /** The chat ID sent by AI SDK's useChat hook. */
  id?: string;
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

type QueryReader = (name: string) => string | undefined;

/** Resolves one Editor agent version selector from the route query. */
function resolveAgentVersionFromQuery(
  query: QueryReader,
  fallback?: AgentVersionOptions,
): AgentVersionOptions | undefined {
  const versionId = query('versionId');
  const status = query('status');
  if (versionId && status) {
    throw new Error('Query parameters "versionId" and "status" are mutually exclusive');
  }
  if (status && status !== 'draft' && status !== 'published') {
    throw new Error('Query parameter "status" must be "draft" or "published"');
  }
  return versionId ? { versionId } : status ? { status: status as 'draft' | 'published' } : fallback;
}

/** Wraps a UI message stream in the response implementation for its AI SDK version. */
function createChatUIMessageStreamResponse(stream: ReadableStream<any>, version: 'v5' | 'v6' | 'v7'): Response {
  if (version === 'v7') return createUIMessageStreamResponseV7({ stream });
  if (version === 'v6') return createUIMessageStreamResponseV6({ stream });
  return createUIMessageStreamResponseV5({ stream });
}

export type ChatStreamHandlerOptions<UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage, OUTPUT = undefined> = {
  mastra: Mastra;
  agentId: string;
  agentVersion?: AgentVersionOptions;
  params: ChatStreamHandlerParams<UI_MESSAGE, OUTPUT>;
  defaultOptions?: ChatStreamDefaultOptions<OUTPUT>;
  /** Experimental transforms applied before converting Mastra chunks to AI SDK UI chunks. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
  version?: 'v5' | 'v6' | 'v7';
  sendStart?: boolean;
  sendFinish?: boolean;
  sendReasoning?: boolean;
  sendSources?: boolean;
  /**
   * Whether to emit `data-tool-agent` / `data-tool-agent-step` parts with sub-agent progress
   * when the agent delegates to sub-agents. Defaults to `true`.
   */
  includeSubAgentMetadata?: boolean;
  onError?: (error: unknown) => string;
  /** Maps stream parts to metadata on AI SDK start and finish message parts. Also receives the run's `traceId`. */
  messageMetadata?: UI_MESSAGE extends V6UIMessage
    ? WithTraceId<UIMessageStreamOptionsV6<UI_MESSAGE>['messageMetadata']>
    : UI_MESSAGE extends V5UIMessage
      ? WithTraceId<UIMessageStreamOptionsV5<UI_MESSAGE>['messageMetadata']>
      : never;
};

type ChatStreamHandlerOptionsV5<UI_MESSAGE extends V5UIMessage = V5UIMessage, OUTPUT = undefined> = Omit<
  ChatStreamHandlerOptions<UI_MESSAGE, OUTPUT>,
  'version' | 'messageMetadata'
> & {
  version?: 'v5';
  messageMetadata?: WithTraceId<UIMessageStreamOptionsV5<UI_MESSAGE>['messageMetadata']>;
};

type ChatStreamHandlerOptionsV6<UI_MESSAGE extends V6UIMessage = V6UIMessage, OUTPUT = undefined> = Omit<
  ChatStreamHandlerOptions<UI_MESSAGE, OUTPUT>,
  'version' | 'messageMetadata'
> & {
  version: 'v6';
  messageMetadata?: WithTraceId<UIMessageStreamOptionsV6<UI_MESSAGE>['messageMetadata']>;
};

type ChatStreamHandlerOptionsV7<UI_MESSAGE extends V7UIMessage = V7UIMessage, OUTPUT = undefined> = Omit<
  ChatStreamHandlerOptions<UI_MESSAGE, OUTPUT>,
  'version' | 'messageMetadata'
> & {
  version: 'v7';
  messageMetadata?: WithTraceId<UIMessageStreamOptionsV7<UI_MESSAGE>['messageMetadata']>;
};

/** Resolves the configured agent, including Editor-stored overrides and explicit version selectors. */
async function resolveChatAgent({
  mastra,
  agentId,
  agentVersion,
  requestContext,
  defaultToPublished = true,
}: {
  mastra: Mastra;
  agentId: string;
  agentVersion?: AgentVersionOptions;
  requestContext?: RequestContext;
  defaultToPublished?: boolean;
}) {
  const baseAgent = mastra.getAgentById(agentId);
  if (!baseAgent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const editorAgent = mastra.getEditor?.()?.agent;
  if (editorAgent) {
    if (!agentVersion && !defaultToPublished) return baseAgent;
    return editorAgent.applyStoredOverrides(baseAgent, agentVersion ?? { status: 'published' }, requestContext);
  }

  if (agentVersion) {
    return mastra.getAgentById(agentId, agentVersion);
  }

  return baseAgent;
}

const MASTRA_AUTH_MODE_KEY = 'mastra__authMode';

type ChatFGAProvider = NonNullable<NonNullable<ReturnType<Mastra['getServer']>>['fga']>;

/** Selects the FGA provider for the request's trusted authentication mode. */
function resolveChatFGAProvider(mastra: Mastra, requestContext?: RequestContext): ChatFGAProvider | null | undefined {
  const studioFga = mastra.getStudio()?.fga;
  const serverFga = mastra.getServer()?.fga;

  if (requestContext?.get(MASTRA_AUTH_MODE_KEY) === 'studio' && studioFga) return studioFga;
  if (serverFga) return serverFga;
  return studioFga ? null : undefined;
}

/** Authorizes replay using the same resource ownership and thread FGA rules as run observation. */
async function authorizeChatRunObservation({
  mastra,
  agent,
  runRecord,
  requestContext,
}: {
  mastra: Mastra;
  agent: Awaited<ReturnType<typeof resolveChatAgent>>;
  runRecord: { resourceId?: string; threadId?: string };
  requestContext?: RequestContext;
}): Promise<boolean> {
  const resourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
  const server = mastra.getServer();
  const fgaProvider = resolveChatFGAProvider(mastra, requestContext);
  if (fgaProvider === null) return false;
  const tenancy =
    typeof (server?.auth as { mapUserToResourceId?: unknown } | undefined)?.mapUserToResourceId === 'function';

  if (tenancy) {
    if (resourceId) {
      if (runRecord.resourceId !== resourceId) return false;
    } else if (!fgaProvider || !runRecord.threadId) {
      return false;
    }
  } else if (runRecord.resourceId && runRecord.resourceId !== resourceId) {
    return false;
  }

  if (!runRecord.threadId) return true;

  requestContext?.set(MASTRA_THREAD_ID_KEY, runRecord.threadId);
  const memory = await agent.getMemory({ requestContext });
  const thread = await memory?.getThreadById({ threadId: runRecord.threadId });
  if (resourceId && thread?.resourceId && thread.resourceId !== resourceId) return false;

  if (fgaProvider) {
    const user = requestContext?.get('user');
    if (!user || typeof user !== 'object') return false;
    try {
      await MastraMemory.checkThreadFGA({
        mastra,
        user: user as Record<string, unknown>,
        threadId: runRecord.threadId,
        resourceId: (thread?.resourceId as string | undefined) ?? runRecord.resourceId ?? resourceId,
        requestContext,
        fgaProvider,
      });
    } catch {
      return false;
    }
  }

  return true;
}

/** Converts a Mastra agent stream to the requested AI SDK UI message stream version. */
function createChatUIMessageStream({
  result,
  messages,
  version,
  lastMessageId,
  sendStart,
  sendFinish,
  sendReasoning,
  sendSources,
  includeSubAgentMetadata,
  experimentalTransform,
  onError,
  messageMetadata,
}: {
  result: any;
  messages: SupportedUIMessage[];
  version: 'v5' | 'v6' | 'v7';
  lastMessageId?: string;
  sendStart: boolean;
  sendFinish: boolean;
  sendReasoning: boolean;
  sendSources: boolean;
  includeSubAgentMetadata: boolean;
  experimentalTransform?: MastraStreamTransformOptions<any>;
  onError?: (error: unknown) => string;
  messageMetadata?: any;
}): ReadableStream<any> {
  if (version === 'v6' || version === 'v7') {
    const createUIMessageStream = (
      version === 'v7' ? createUIMessageStreamV7 : createUIMessageStreamV6
    ) as typeof createUIMessageStreamV6;
    return createUIMessageStream<any>({
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
          includeSubAgentMetadata,
          experimentalTransform,
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
        includeSubAgentMetadata,
        experimentalTransform,
        onError,
        messageMetadata: messageMetadata as UIMessageStreamOptionsV5<V5UIMessage>['messageMetadata'],
      })) {
        writer.write(part);
      }
    },
  }) as ReadableStream<any>;
}

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
export function handleChatStream<UI_MESSAGE extends V7UIMessage = V7UIMessage, OUTPUT = undefined>(
  options: ChatStreamHandlerOptionsV7<UI_MESSAGE, OUTPUT>,
): Promise<V7UIMessageStream<UI_MESSAGE>>;
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
  includeSubAgentMetadata = true,
  onError,
  messageMetadata,
}: Omit<ChatStreamHandlerOptions<any, OUTPUT>, 'messageMetadata'> & {
  messageMetadata?: any;
}): Promise<ReadableStream<any>> {
  const { messages, resumeData, runId, requestContext, trigger, ...rest } = params;

  if (resumeData && !runId) {
    throw new Error('runId is required when resumeData is provided');
  }

  const agentObj = await resolveChatAgent({
    mastra,
    agentId,
    agentVersion,
    requestContext: requestContext as RequestContext | undefined,
  });

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
  // Never let a caller's credential headers override the server's provider auth.
  if (restOptions.modelSettings?.headers) {
    restOptions.modelSettings = {
      ...restOptions.modelSettings,
      headers: Object.fromEntries(
        Object.entries(restOptions.modelSettings.headers).filter(
          ([name]) => !CREDENTIAL_HEADER_NAMES.has(name.toLowerCase()),
        ),
      ),
    };
  }
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

  // AI SDK v6/v7 re-submit approval responses on assistant tool parts. Scan the
  // whole request because the answered card may be on an earlier assistant
  // message, then resume every exact run/tool-call target in request order.
  // A trailing user message remains a normal chat turn; consuming it as an
  // approval resume would silently drop the user's new request.
  if (
    (version === 'v6' || version === 'v7') &&
    !resumeData &&
    trigger !== 'regenerate-message' &&
    messages.at(-1)?.role === 'assistant'
  ) {
    const approvals = extractV6NativeApprovals(messages as V6UIMessage[]);
    if (approvals.length > 0) {
      return streamV6ApprovalResumes({
        version,
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
        includeSubAgentMetadata,
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

  return createChatUIMessageStream({
    result,
    messages,
    version,
    lastMessageId,
    sendStart,
    sendFinish,
    sendReasoning,
    sendSources,
    includeSubAgentMetadata,
    experimentalTransform: effectiveExperimentalTransform,
    onError,
    messageMetadata,
  });
}

export type chatRouteOptions<OUTPUT = undefined, UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage> = {
  defaultOptions?: ChatStreamDefaultOptions<OUTPUT>;
  /** Experimental transforms applied before converting Mastra chunks to AI SDK UI chunks. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
  version?: 'v5' | 'v6' | 'v7';
  agentVersion?: AgentVersionOptions;
  /** Enable AI SDK resumable streams with `useChat({ resume: true })`. */
  resumable?: boolean;
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
    /** Whether to emit `data-tool-agent` / `data-tool-agent-step` parts with sub-agent progress. Defaults to `true`. */
    includeSubAgentMetadata?: boolean;
    /** Target interval for periodic SSE comment heartbeats. Values up to 0 disable heartbeats. `NaN`, positive infinity, and values above 2,147,483,647 throw a `RangeError`. */
    heartbeatMs?: number;
    onError?: (error: unknown) => string;
    /** Metadata attached to start and finish message parts in the AI SDK stream. */
    messageMetadata?: ChatStreamHandlerOptions<UI_MESSAGE, OUTPUT>['messageMetadata'];
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
 * @param {boolean} [options.resumable=false] - Enables AI SDK resumable streams for `useChat({ resume: true })`. Registers `GET <path>/:chatId/stream`, uses the POST chat ID as the Mastra memory thread ID, and lets the run continue when the POST connection closes.
 * @param {boolean} [options.sendStart=true] - Whether to send start events in the stream
 * @param {boolean} [options.sendFinish=true] - Whether to send finish events in the stream
 * @param {boolean} [options.sendReasoning=false] - Whether to include reasoning steps in the stream
 * @param {boolean} [options.sendSources=false] - Whether to include source citations in the stream
 * @param {boolean} [options.includeSubAgentMetadata=true] - Whether to emit `data-tool-agent` / `data-tool-agent-step` parts with sub-agent progress
 * @param {number} [options.heartbeatMs] - Target interval for periodic SSE comment heartbeats. Already-buffered source events and stream lifecycle signals take priority. Values up to 0 disable heartbeats. `NaN`, positive infinity, and values above 2,147,483,647 throw a `RangeError`.
 * @param {(error: unknown) => string} [options.onError] - Custom error serializer streamed to the client. When omitted, errors are passed through a default serializer that strips sensitive fields (e.g. `APICallError.requestBodyValues`, which holds the system prompt) before they reach the client.
 * @param {Function} [options.messageMetadata] - Maps stream parts to metadata attached to AI SDK start and finish message parts. Receives `{ part, traceId }`.
 *
 * @returns A POST route, or `[postRoute, reconnectRoute]` when `resumable: true`
 *
 * @throws {Error} When path doesn't include `:agentId` and no fixed agent is specified
 * @throws {RangeError} When `heartbeatMs` is `NaN`, positive infinity, or greater than 2,147,483,647
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
 * - The response is a Server-Sent Events (SSE) stream compatible with the selected AI SDK version
 * - If both `agent` and `:agentId` are present, a warning is logged and the fixed `agent` takes precedence
 * - Request context from the incoming request overrides `defaultOptions.requestContext` if both are present
 * - With `resumable: true`, scoped runs can only be resumed with matching resource and thread IDs in request context
 * - Resumption returns 204 when the run is unknown, expired, or already finished
 * - Abort-based cancellation is unavailable because HTTP disconnects must not abort resumable runs
 */
type ChatApiRoute = ReturnType<typeof registerApiRoute>;
type ResumableChatApiRoutes = [postRoute: ChatApiRoute, reconnectRoute: ChatApiRoute];

export function chatRoute<OUTPUT = undefined, UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage>(
  options: chatRouteOptions<OUTPUT, UI_MESSAGE> & { resumable: true },
): ResumableChatApiRoutes;
export function chatRoute<OUTPUT = undefined, UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage>(
  options: chatRouteOptions<OUTPUT, UI_MESSAGE> & { resumable?: false },
): ChatApiRoute;
export function chatRoute<OUTPUT = undefined, UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage>(
  options: chatRouteOptions<OUTPUT, UI_MESSAGE>,
): ChatApiRoute | ResumableChatApiRoutes;
export function chatRoute<OUTPUT = undefined, UI_MESSAGE extends SupportedUIMessage = SupportedUIMessage>({
  path = '/chat/:agentId',
  agent,
  defaultOptions,
  experimentalTransform,
  version = 'v5',
  agentVersion,
  resumable = false,
  sendStart = true,
  sendFinish = true,
  sendReasoning = false,
  sendSources = false,
  includeSubAgentMetadata = true,
  heartbeatMs,
  onError,
  messageMetadata,
}: chatRouteOptions<OUTPUT, UI_MESSAGE>): ChatApiRoute | ResumableChatApiRoutes {
  if (!agent && !path.includes('/:agentId')) {
    throw new Error('Path must include :agentId to route to the correct agent or pass the agent explicitly');
  }
  assertValidHeartbeatMs(heartbeatMs);

  const postRoute = registerApiRoute(path, {
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
      const configuredRequestContext = contextRequestContext || defaultOptions?.requestContext || params.requestContext;
      const effectiveRequestContext =
        resumable && params.id
          ? new RequestContext(configuredRequestContext ? configuredRequestContext.entries() : undefined)
          : configuredRequestContext;
      if (resumable && params.id) {
        (effectiveRequestContext as RequestContext).set(MASTRA_THREAD_ID_KEY, params.id);
      }

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

      const effectiveAgentVersion = resolveAgentVersionFromQuery(name => c.req.query(name), agentVersion);
      const resumableResourceId = (effectiveRequestContext as RequestContext | undefined)?.get<string>(
        MASTRA_RESOURCE_ID_KEY,
      );

      const handlerOptions = {
        mastra,
        agentId: agentToUse,
        agentVersion: effectiveAgentVersion,
        params: {
          ...params,
          ...(resumable && params.id
            ? {
                memory: {
                  ...(typeof params.memory === 'object' ? params.memory : {}),
                  ...(resumableResourceId ? { resource: resumableResourceId } : {}),
                  thread: params.id,
                },
              }
            : {}),
          requestContext: effectiveRequestContext,
          ...(!resumable && { abortSignal: c.req.raw.signal }),
        } as any,
        defaultOptions,
        experimentalTransform,
        sendStart,
        sendFinish,
        sendReasoning,
        sendSources,
        includeSubAgentMetadata,
        onError,
      };

      const uiMessageStream =
        version === 'v7'
          ? await handleChatStream({
              ...handlerOptions,
              version: 'v7',
              messageMetadata: messageMetadata as UIMessageStreamOptionsV7<V7UIMessage>['messageMetadata'],
            })
          : version === 'v6'
            ? await handleChatStream({
                ...handlerOptions,
                version: 'v6',
                messageMetadata: messageMetadata as UIMessageStreamOptionsV6<V6UIMessage>['messageMetadata'],
              })
            : await handleChatStream({
                ...handlerOptions,
                messageMetadata: messageMetadata as UIMessageStreamOptionsV5<V5UIMessage>['messageMetadata'],
              });

      return withSseHeartbeat(createChatUIMessageStreamResponse(uiMessageStream, version), heartbeatMs);
    },
  });

  if (!resumable) {
    return postRoute;
  }

  const reconnectPath = `${path.replace(/\/$/, '')}/:chatId/stream`;
  const reconnectRoute = registerApiRoute(reconnectPath, {
    method: 'GET',
    openapi: {
      summary: 'Reconnect to an agent chat stream',
      description: 'Replay and follow the active agent run for an AI SDK chat',
      tags: ['ai-sdk'],
      parameters: [
        ...(path.includes(':agentId')
          ? [
              {
                name: 'agentId',
                in: 'path' as const,
                required: true,
                schema: { type: 'string' as const },
              },
            ]
          : []),
        {
          name: 'chatId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'versionId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
        {
          name: 'status',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: ['draft', 'published'] },
        },
      ],
      responses: {
        '200': {
          description: 'Replayable streaming response from the agent run',
          content: {
            'text/plain': {
              schema: { type: 'string' },
            },
          },
        },
        '204': {
          description: 'The chat has no active resumable run',
        },
        '404': {
          description: 'The active run does not belong to the current resource or thread',
        },
      },
    },
    handler: async c => {
      const mastra = c.get('mastra');
      const middlewareRequestContext = (c as any).get('requestContext') as RequestContext | undefined;
      const requestContext =
        middlewareRequestContext ||
        (defaultOptions?.requestContext ? new RequestContext(defaultOptions.requestContext.entries()) : undefined);
      const agentToUse = agent ?? c.req.param('agentId');
      const chatId = c.req.param('chatId');

      if (!agentToUse || !chatId) {
        return new Response(null, { status: 204 });
      }

      const effectiveAgentVersion = resolveAgentVersionFromQuery(name => c.req.query(name), agentVersion);

      const agentObj = await resolveChatAgent({
        mastra,
        agentId: agentToUse,
        agentVersion: effectiveAgentVersion,
        requestContext,
        defaultToPublished: false,
      });
      const resourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
      const runId = agentObj.getActiveThreadRunId({ threadId: chatId, resourceId });
      if (!runId) {
        return new Response(null, { status: 204 });
      }
      const runRecord = await agentObj.__getRunRecord(runId);
      if (!runRecord || runRecord.status === 'finished') {
        return new Response(null, { status: 204 });
      }

      if (!(await authorizeChatRunObservation({ mastra, agent: agentObj, runRecord, requestContext }))) {
        return new Response(null, { status: 404 });
      }

      const observed = await agentObj.observe(runId);
      const uiMessageStream = createChatUIMessageStream({
        result: observed.output,
        messages: [],
        version,
        sendStart,
        sendFinish,
        sendReasoning,
        sendSources,
        includeSubAgentMetadata,
        experimentalTransform,
        onError,
        messageMetadata,
      });

      return withSseHeartbeat(createChatUIMessageStreamResponse(uiMessageStream, version), heartbeatMs);
    },
  });

  return [postRoute, reconnectRoute];
}
