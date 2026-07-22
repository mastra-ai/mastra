import { v4 as uuid } from '@lukeed/uuid';
import { MastraClient } from '@mastra/client-js';
import type { AIV5Type, MastraDBMessage, MastraToolInvocationPart } from '@mastra/core/agent/message-list';
import { AIV5Adapter } from '@mastra/core/agent/message-list';
import type { CoreUserMessage } from '@mastra/core/llm';
import type { TracingOptions } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import type { TaskItem } from '@mastra/core/signals';
import type { ChunkType, DataChunkType, NetworkChunkType } from '@mastra/core/stream';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  accumulateChunk,
  accumulateNetworkChunk,
  CLIENT_MESSAGE_ID_KEY,
  finishStreamingAssistantMessage,
  fromCoreUserMessagesToMastraDBMessage,
} from '../lib/mastra-db';
import type { MastraDBMessageMetadata } from '../lib/mastra-db';
import { useMastraClient } from '../mastra-client-context';
import {
  extractLatestTasksFromMessages,
  extractTasksFromSignalChunk,
  extractTasksFromToolResultChunk,
} from './extract-tasks';
import { extractRunIdFromMessages } from './extractRunIdFromMessages';
import { convertSignalDataToBase64String } from './signal-data';
import type { ClientToolsInput, ModelSettings } from './types';

const extractPendingToolApprovalIdsFromMessages = (messages: MastraDBMessage[]) => {
  const pendingToolApprovalIds = new Set<string>();

  for (const message of messages) {
    const metadata = message.content?.metadata as MastraDBMessageMetadata | undefined;
    if (!metadata) continue;

    // Only explicit `requireApproval` gates are pending approvals. `suspendedTools`
    // covers generic runtime `context.agent.suspend()` suspensions, which have no
    // approve/decline UI and auto-resume from a follow-up message — treating them as
    // pending approvals wrongly parks the composer in an "awaiting approval" state.
    const metadataSources = [metadata.pendingToolApprovals, metadata.requireApprovalMetadata] as Array<
      Record<string, { toolCallId?: unknown }> | undefined
    >;

    for (const source of metadataSources) {
      if (!source || typeof source !== 'object') continue;

      for (const suspensionData of Object.values(source)) {
        const toolCallId = suspensionData?.toolCallId;
        if (typeof toolCallId === 'string' && toolCallId.length > 0) {
          pendingToolApprovalIds.add(toolCallId);
        }
      }
    }
  }

  return pendingToolApprovalIds;
};

const toolCallHasOutput = (parts: MastraDBMessage['content']['parts'], toolCallId: string): boolean =>
  parts.some(part => {
    if (part.type !== 'tool-invocation') return false;
    const invocation = (part as MastraToolInvocationPart).toolInvocation;
    if (invocation.toolCallId !== toolCallId) return false;
    return invocation.state === 'result' || (invocation as { result?: unknown }).result != null;
  });

/**
 * Normalize persisted initial messages back into the stream-friendly shape the
 * UI renders from. Mirrors `main`'s `resolveInitialMessages`:
 *
 * - Converts persisted `pendingToolApprovals` (DB shape) into
 *   `requireApprovalMetadata` (stream shape) so reloaded threads still render
 *   approve/decline buttons, filtering out approvals whose tool already
 *   produced output, and marks the message `mode: 'stream'`.
 * - Drops assistant completion messages flagged `suppressFeedback`, which are
 *   persisted by the supervisor agent but must stay hidden on reload.
 */
const resolveInitialMessages = (messages: MastraDBMessage[]): MastraDBMessage[] =>
  messages
    .filter(message => {
      const metadata = message.content?.metadata as MastraDBMessageMetadata | undefined;
      if (metadata?.completionResult?.suppressFeedback || metadata?.isTaskCompleteResult?.suppressFeedback) {
        return false;
      }
      return true;
    })
    .map(message => {
      const metadata = message.content?.metadata as MastraDBMessageMetadata | undefined;

      // A persisted/refetched thread must never show a stuck "sending" bubble
      // and must never carry the optimistic correlation key: the pending status
      // and its `clientMessageId` are transient UI state. The `clientMessageId`
      // can survive into storage (it is sent to the server with the message), so
      // strip it on every reload regardless of pending status; the rendered row
      // key falls back to the stable server `id`.
      const normalizedMessage =
        metadata && (metadata.status === 'pending' || CLIENT_MESSAGE_ID_KEY in metadata)
          ? (() => {
              const { [CLIENT_MESSAGE_ID_KEY]: _omitClientMessageId, ...rest } = metadata;
              const { status: _omitStatus, ...restWithoutStatus } = rest;
              return {
                ...message,
                content: {
                  ...message.content,
                  metadata: metadata.status === 'pending' ? restWithoutStatus : rest,
                },
              };
            })()
          : message;

      const normalizedMetadata = normalizedMessage.content?.metadata as MastraDBMessageMetadata | undefined;
      const pendingToolApprovals = normalizedMetadata?.pendingToolApprovals;
      if (!pendingToolApprovals || typeof pendingToolApprovals !== 'object') {
        return normalizedMessage;
      }

      const stillPending = Object.fromEntries(
        Object.entries(pendingToolApprovals).filter(
          ([, approval]) =>
            approval &&
            typeof approval === 'object' &&
            typeof approval.toolCallId === 'string' &&
            !toolCallHasOutput(normalizedMessage.content.parts, approval.toolCallId),
        ),
      );

      const { pendingToolApprovals: _omit, ...restMetadata } = normalizedMetadata;
      const hasStillPending = Object.keys(stillPending).length > 0;

      return {
        ...normalizedMessage,
        content: {
          ...normalizedMessage.content,
          metadata: {
            ...restMetadata,
            mode: 'stream' as const,
            ...(hasStillPending ? { pendingToolApprovals: stillPending, requireApprovalMetadata: stillPending } : {}),
          },
        },
      };
    });

type SignalContinuationOptions = {
  model?: string;
  maxSteps?: number;
  modelSettings?: {
    frequencyPenalty?: number;
    presencePenalty?: number;
    maxRetries?: number;
    maxOutputTokens?: number;
    temperature?: number;
    topK?: number;
    topP?: number;
  };
  instructions?: ModelSettings['instructions'];
  providerOptions?: ModelSettings['providerOptions'];
  requireToolApproval?: boolean;
  tracingOptions?: TracingOptions;
};

type ActiveContinuation = {
  model?: string;
  requestContext?: RequestContext;
};

export interface MastraChatProps {
  agentId: string;
  resourceId?: string;
  threadId?: string;
  initialMessages?: MastraDBMessage[];
  /** Persistent request context used for tool approval/decline calls (e.g. agentVersionId). */
  requestContext?: RequestContext;
  /**
   * Client-side tool definitions. Forwarded once to `subscribeToThread` so
   * the client-js subscription drives the full client-tool execution loop
   * (execute, emit tool-result, continuation) without any logic in React.
   */
  clientTools?: ClientToolsInput;
  onSignalSent?: (signalId: string, preview: string) => void;
  onSignalEcho?: (signalId: string) => void;
  onThreadSignalsUnsupported?: () => void;
  /**
   * Use the agent-signals streaming path (sendSignal + subscribeToThread).
   * Defaults to `false`; set to `true` to opt into thread signals.
   */
  enableThreadSignals?: boolean;
}

interface SharedArgs {
  coreUserMessages: CoreUserMessage[];
  model?: string;
  requestContext?: RequestContext;
  threadId?: string;
  modelSettings?: ModelSettings;
  signal?: AbortSignal;
  tracingOptions?: TracingOptions;
}

export type SendMessageArgs = { message: string; coreUserMessages?: CoreUserMessage[] } & (
  | ({ mode: 'generate' } & Omit<GenerateArgs, 'coreUserMessages'>)
  | ({ mode: 'stream' } & Omit<StreamArgs, 'coreUserMessages'>)
  | ({ mode: 'network' } & Omit<NetworkArgs, 'coreUserMessages'>)
  | ({ mode?: undefined } & Omit<StreamArgs, 'coreUserMessages'>)
);

export type GenerateArgs = SharedArgs & {
  onFinish?: (messages: MastraDBMessage[]) => Promise<void>;
  clientTools?: ClientToolsInput;
};

export type StreamArgs = SharedArgs & {
  onChunk?: (chunk: ChunkType) => Promise<void>;
  clientTools?: ClientToolsInput;
  signalId?: string;
  /**
   * Client-generated correlation id stamped on the optimistic pending bubble
   * and the outgoing message metadata so the server echo can reconcile them.
   */
  clientMessageId?: string;
};

export type NetworkArgs = SharedArgs & {
  onNetworkChunk?: (chunk: NetworkChunkType) => Promise<void>;
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getErrorName = (error: unknown) => (isObject(error) && typeof error.name === 'string' ? error.name : undefined);

const isAbortError = (error: unknown) => getErrorName(error) === 'AbortError';

const isThreadSignalUnsupportedError = (error: unknown) => {
  if (!isObject(error)) return false;

  const status = error.status;
  if (status === 404 || status === 405 || status === 501) {
    return true;
  }

  return (
    status === 400 &&
    typeof error.message === 'string' &&
    error.message.includes('No active agent run found for signal target')
  );
};

type DataChunk = Extract<ChunkType, DataChunkType>;

const isDataChunk = (chunk: ChunkType): chunk is DataChunk =>
  typeof chunk.type === 'string' && chunk.type.startsWith('data-');

/**
 * Convert AI-SDK v5 UIMessages returned by the server (generate mode) into
 * `MastraDBMessage[]`, stamping the supplied metadata onto each message's
 * `content.metadata`. Private helper — `useChat` never exposes the AI-SDK
 * shape to consumers.
 */
const dbFromServerUiMessages = (
  uiMessages: AIV5Type.UIMessage[],
  metadata: MastraDBMessageMetadata,
): MastraDBMessage[] =>
  uiMessages.map(uiMsg => {
    const dbMsg = AIV5Adapter.fromUIMessage(uiMsg);
    return {
      ...dbMsg,
      content: {
        ...dbMsg.content,
        metadata: {
          ...(dbMsg.content.metadata ?? {}),
          ...metadata,
        },
      },
    };
  });

export const useChat = ({
  agentId,
  resourceId,
  threadId,
  initialMessages,
  requestContext: propsRequestContext,
  clientTools: hookClientTools,
  onSignalSent,
  onSignalEcho,
  onThreadSignalsUnsupported,
  enableThreadSignals = false,
}: MastraChatProps) => {
  const threadSignalsDisabled = enableThreadSignals === false;
  const _currentRunId = useRef<string | undefined>(undefined);
  const _onChunk = useRef<((chunk: ChunkType) => Promise<void>) | undefined>(undefined);
  const _networkRunId = useRef<string | undefined>(undefined);
  const _onNetworkChunk = useRef<((chunk: NetworkChunkType) => Promise<void>) | undefined>(undefined);
  const _activeContinuation = useRef<ActiveContinuation>({ requestContext: propsRequestContext });
  // Tracks the active stream (untilIdle) request so a subsequent stream() call
  // can abort the previous one. Without this, a still-open prior stream keeps
  // its background-task pubsub subscription alive and fans events into a second
  // concurrent UI consumer, producing duplicate bg-task events and duplicate
  // continuation turns on the server.
  const _streamAbortRef = useRef<AbortController | null>(null);
  const _threadSubscriptionAbortRef = useRef<AbortController | null>(null);
  const _threadSubscriptionRef = useRef<{ abort?: () => Promise<boolean> | boolean; unsubscribe?: () => void } | null>(
    null,
  );
  const _threadSubscriptionKeyRef = useRef<string | undefined>(undefined);
  const _threadSubscriptionPromiseRef = useRef<Promise<void> | null>(null);
  const _threadSignalsUnsupportedRef = useRef(false);
  const [messages, setMessages] = useState<MastraDBMessage[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [toolCallApprovals, setToolCallApprovals] = useState<{
    [toolCallId: string]: { status: 'approved' | 'declined' };
  }>({});
  const [networkToolCallApprovals, setNetworkToolCallApprovals] = useState<{
    [toolName: string]: { status: 'approved' | 'declined' };
  }>({});
  const pendingToolApprovalIdsRef = useRef(new Set<string>());
  const [isAwaitingToolApproval, setIsAwaitingToolApproval] = useState(false);

  const baseClient = useMastraClient();
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const formattedMessages = resolveInitialMessages(initialMessages ?? []);
    setMessages(formattedMessages);
    setTasks(extractLatestTasksFromMessages(formattedMessages));
    pendingToolApprovalIdsRef.current = extractPendingToolApprovalIdsFromMessages(formattedMessages);
    setIsAwaitingToolApproval(pendingToolApprovalIdsRef.current.size > 0);
    _currentRunId.current = extractRunIdFromMessages(formattedMessages);
  }, [initialMessages]);

  useEffect(() => {
    _activeContinuation.current = {
      ..._activeContinuation.current,
      requestContext: propsRequestContext,
    };
  }, [propsRequestContext]);

  type SignalContentPart =
    { type: 'text'; text: string } | { type: 'file'; data: string; mediaType: string; filename?: string };
  type UserMessageSignalContents = string | SignalContentPart[];

  const normalizeSignalFileData = (data: string | URL | ArrayBuffer | Uint8Array) => {
    if (data instanceof URL) return data.toString();
    return convertSignalDataToBase64String(data);
  };

  const getSignalContents = (coreUserMessages: CoreUserMessage[]): UserMessageSignalContents => {
    const parts = coreUserMessages.reduce<SignalContentPart[]>((allParts, message) => {
      if (typeof message.content === 'string') {
        allParts.push({ type: 'text', text: message.content });
        return allParts;
      }

      for (const part of message.content) {
        if (part.type === 'text') {
          allParts.push({ type: 'text', text: part.text });
        } else if (part.type === 'file') {
          allParts.push({
            type: 'file',
            data: normalizeSignalFileData(part.data),
            mediaType: part.mimeType,
            ...(part.filename ? { filename: part.filename } : {}),
          });
        } else if (part.type === 'image') {
          allParts.push({
            type: 'file',
            data: normalizeSignalFileData(part.image),
            mediaType: part.mimeType ?? 'image/png',
          });
        }
      }

      return allParts;
    }, []);

    return parts.length === 1 && parts[0]?.type === 'text' ? parts[0].text : parts;
  };

  const markThreadSignalsUnsupported = useCallback(() => {
    _threadSignalsUnsupportedRef.current = true;
    onThreadSignalsUnsupported?.();
  }, [onThreadSignalsUnsupported]);

  const getSignalPreview = (coreUserMessages: CoreUserMessage[]) => {
    const preview = coreUserMessages
      .flatMap(message => {
        if (typeof message.content === 'string') {
          return [message.content];
        }

        return message.content.map(part => {
          if (part.type === 'text') return part.text;
          if (part.type === 'image') return 'Image';
          return part.filename ? `File: ${part.filename}` : 'File';
        });
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return preview || 'Attachment';
  };

  const closeThreadSubscription = useCallback(() => {
    const subscription = _threadSubscriptionRef.current;
    if (subscription?.unsubscribe) {
      subscription.unsubscribe();
    } else {
      _threadSubscriptionAbortRef.current?.abort();
    }
    _threadSubscriptionRef.current = null;
    _threadSubscriptionAbortRef.current = null;
    _threadSubscriptionKeyRef.current = undefined;
    _threadSubscriptionPromiseRef.current = null;
  }, []);

  const processStreamChunk = useCallback(
    async (chunk: ChunkType, onChunk?: (chunk: ChunkType) => Promise<void>) => {
      setMessages(prev => accumulateChunk({ chunk, conversation: prev, metadata: { mode: 'stream' } }));

      const signalTasks = extractTasksFromSignalChunk(chunk);
      if (signalTasks !== undefined) setTasks(signalTasks);
      const toolTasks = extractTasksFromToolResultChunk(chunk);
      if (toolTasks !== undefined) setTasks(toolTasks);

      if (
        chunk.type === 'data-user-message' &&
        isDataChunk(chunk) &&
        (chunk.data?.type === 'user-message' || chunk.data?.type === 'user') &&
        typeof chunk.data?.id === 'string'
      ) {
        onSignalEcho?.(chunk.data.id);
      }

      if (chunk.type === 'start') {
        setIsRunning(true);
        if ('runId' in chunk && typeof chunk.runId === 'string') {
          _currentRunId.current = chunk.runId;
        }
      }

      if (chunk.type === 'tool-call-approval') {
        const toolCallId = chunk.payload?.toolCallId;
        if (typeof toolCallId === 'string') {
          pendingToolApprovalIdsRef.current.add(toolCallId);
          setIsAwaitingToolApproval(true);
        }
        setIsRunning(false);
      }

      // A generic runtime `context.agent.suspend()` ends the run without an approval gate.
      // Stop the run indicator but do not enter the awaiting-approval state — the user
      // resumes it by sending a follow-up message, which auto-resumes server-side.
      if (chunk.type === 'tool-call-suspended') {
        setIsRunning(false);
      }

      if (chunk.type === 'finish' || chunk.type === 'abort' || chunk.type === 'error') {
        pendingToolApprovalIdsRef.current.clear();
        setIsAwaitingToolApproval(false);
        setIsRunning(false);
      }

      void (onChunk ?? _onChunk.current)?.(chunk);
    },
    [onSignalEcho],
  );

  const ensureThreadSubscription = useCallback(
    async ({ threadId, resourceId }: { threadId: string; resourceId?: string }) => {
      const subscriptionKey = `${agentId}:${resourceId ?? ''}:${threadId}`;
      if (_threadSubscriptionKeyRef.current === subscriptionKey && _threadSubscriptionPromiseRef.current) {
        await _threadSubscriptionPromiseRef.current;
        return;
      }

      closeThreadSubscription();
      const subscriptionAbort = new AbortController();
      _threadSubscriptionAbortRef.current = subscriptionAbort;
      _threadSubscriptionKeyRef.current = subscriptionKey;

      // Release the cached subscription state, but only while this attempt
      // still owns it — a newer attempt cleans up after itself.
      const releaseSubscriptionRefs = () => {
        if (_threadSubscriptionAbortRef.current !== subscriptionAbort) return;
        _threadSubscriptionRef.current = null;
        _threadSubscriptionAbortRef.current = null;
        _threadSubscriptionKeyRef.current = undefined;
        _threadSubscriptionPromiseRef.current = null;
      };

      const clientWithAbort = new MastraClient({
        ...baseClient!.options,
        abortSignal: subscriptionAbort.signal,
      });
      const subscriptionAgent = clientWithAbort.getAgent(agentId);

      _threadSubscriptionPromiseRef.current = subscriptionAgent
        .subscribeToThread({ resourceId, threadId })
        .then(response => {
          const subscription = response;
          if (_threadSubscriptionAbortRef.current !== subscriptionAbort) {
            subscription.unsubscribe();
            return;
          }

          _threadSubscriptionRef.current = subscription;
          void subscription
            .processDataStream({
              onChunk: chunk => processStreamChunk(chunk),
            })
            .catch(error => {
              if (!isAbortError(error)) {
                console.error('[useChat] Thread subscription failed', error);
                setIsRunning(false);
              }
            })
            .finally(() => {
              if (_threadSubscriptionRef.current === subscription) {
                _threadSubscriptionRef.current = null;
              }
              releaseSubscriptionRefs();
            });
        })
        .catch(error => {
          // Release on every failure so the next call retries with a fresh
          // fetch instead of re-awaiting this rejected promise. Without this,
          // an aborted mount-time subscribe strands the channel and the reply
          // never arrives until reload (issue #18768).
          releaseSubscriptionRefs();

          if (isThreadSignalUnsupportedError(error)) {
            markThreadSignalsUnsupported();
            return;
          }
          if (!isAbortError(error)) {
            console.error('[useChat] Thread subscription failed', error);
            setIsRunning(false);
          }
          throw error;
        });

      await _threadSubscriptionPromiseRef.current;
    },
    [agentId, baseClient, closeThreadSubscription, markThreadSignalsUnsupported, processStreamChunk],
  );

  useEffect(() => {
    _threadSignalsUnsupportedRef.current = false;
    return closeThreadSubscription;
  }, [agentId, resourceId, threadId, closeThreadSubscription]);

  useEffect(() => {
    if (!threadId || threadSignalsDisabled) {
      closeThreadSubscription();
      return;
    }

    void ensureThreadSubscription({ threadId, resourceId: resourceId || agentId }).catch(error => {
      if (!isAbortError(error)) {
        console.error('[useChat] Thread subscription failed', error);
      }
    });
  }, [agentId, closeThreadSubscription, ensureThreadSubscription, resourceId, threadId, threadSignalsDisabled]);

  const generate = async ({
    coreUserMessages,
    model,
    requestContext,
    threadId,
    modelSettings,
    signal,
    onFinish,
    tracingOptions,
    clientTools,
  }: GenerateArgs) => {
    const {
      frequencyPenalty,
      presencePenalty,
      maxRetries,
      maxTokens,
      temperature,
      topK,
      topP,
      instructions,
      providerOptions,
      maxSteps,
      requireToolApproval,
    } = modelSettings || {};
    const resolvedRequestContext = requestContext ?? propsRequestContext;
    const resolvedClientTools = clientTools ?? hookClientTools;
    _activeContinuation.current = {
      model,
      requestContext: resolvedRequestContext,
    };
    setIsRunning(true);

    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    const runId = uuid();
    _currentRunId.current = runId;

    const response = await agent.generate(coreUserMessages, {
      model,
      runId,
      maxSteps,
      modelSettings: {
        frequencyPenalty,
        presencePenalty,
        maxRetries,
        maxOutputTokens: maxTokens,
        temperature,
        topK,
        topP,
      },
      instructions,
      requestContext: resolvedRequestContext,
      ...(threadId ? { memory: { thread: threadId, resource: resourceId || agentId } } : {}),
      providerOptions,
      tracingOptions,
      requireToolApproval,
      clientTools: resolvedClientTools,
    });

    // Check if suspended for tool approval
    if (response.finishReason === 'suspended' && response.suspendPayload) {
      const { toolCallId, toolName, args } = response.suspendPayload;

      // Add uiMessages with requireApprovalMetadata so UI shows approval buttons
      if (response.response?.uiMessages) {
        const dbMessages = dbFromServerUiMessages(response.response.uiMessages, {
          mode: 'generate',
          requireApprovalMetadata: {
            [toolName]: { toolCallId, toolName, args },
          },
        });

        setMessages(prev => [...prev, ...dbMessages]);
      }

      // Set isRunning to false so approval buttons are enabled
      // The approval/decline functions will set isRunning to true when clicked
      setIsRunning(false);
      return;
    }

    setIsRunning(false);

    if (response && 'uiMessages' in response.response && response.response.uiMessages) {
      const dbMessages = dbFromServerUiMessages(response.response.uiMessages, { mode: 'generate' });
      void onFinish?.(dbMessages);
      setMessages(prev => [...prev, ...dbMessages]);
    }
  };

  const stream = async ({
    coreUserMessages,
    model,
    requestContext,
    threadId,
    onChunk,
    modelSettings,
    signal,
    tracingOptions,
    clientTools,
    signalId,
    clientMessageId,
  }: StreamArgs) => {
    const {
      frequencyPenalty,
      presencePenalty,
      maxRetries,
      maxTokens,
      temperature,
      topK,
      topP,
      instructions,
      providerOptions,
      maxSteps,
      requireToolApproval,
    } = modelSettings || {};

    const resolvedRequestContext = requestContext ?? propsRequestContext;
    const resolvedClientTools = clientTools ?? hookClientTools;
    const signalContinuationOptions: SignalContinuationOptions = {
      model,
      maxSteps,
      modelSettings: {
        frequencyPenalty,
        presencePenalty,
        maxRetries,
        maxOutputTokens: maxTokens,
        temperature,
        topK,
        topP,
      },
      instructions,
      providerOptions,
      requireToolApproval,
      tracingOptions,
    };
    _activeContinuation.current = {
      model,
      requestContext: resolvedRequestContext,
    };
    setIsRunning(true);

    _streamAbortRef.current?.abort();
    const internalAbort = new AbortController();
    _streamAbortRef.current = internalAbort;

    if (signal) {
      if (signal.aborted) internalAbort.abort();
      else signal.addEventListener('abort', () => internalAbort.abort(), { once: true });
    }

    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: internalAbort.signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    const streamWithLegacyRoute = async () => {
      const runId = uuid();
      const response = await agent.stream(coreUserMessages, {
        model,
        runId,
        maxSteps,
        untilIdle: true,
        modelSettings: {
          frequencyPenalty,
          presencePenalty,
          maxRetries,
          maxOutputTokens: maxTokens,
          temperature,
          topK,
          topP,
        },
        instructions,
        requestContext: resolvedRequestContext,
        ...(threadId ? { memory: { thread: threadId, resource: resourceId || agentId } } : {}),
        providerOptions,
        requireToolApproval,
        tracingOptions,
        clientTools: resolvedClientTools,
      });

      _onChunk.current = onChunk;
      _currentRunId.current = runId;

      await response.processDataStream({
        onChunk: chunk => processStreamChunk(chunk, onChunk),
      });

      if (_streamAbortRef.current === internalAbort) {
        _streamAbortRef.current = null;
      }
      setIsRunning(false);
    };

    if (!threadId || _threadSignalsUnsupportedRef.current || threadSignalsDisabled) {
      await streamWithLegacyRoute();
      return;
    }

    _onChunk.current = onChunk;

    await ensureThreadSubscription({ threadId, resourceId: resourceId || agentId });

    if (_threadSignalsUnsupportedRef.current) {
      await streamWithLegacyRoute();
      return;
    }

    const resolvedSignalId = signalId ?? uuid();
    const messageContents = getSignalContents(coreUserMessages);
    // RequestContext serializes to a plain record via its toJSON(), but the class has no
    // index signature, so it isn't assignable to the generated `Record<string, unknown>` body type.
    const requestContextRecord = resolvedRequestContext as Record<string, unknown> | undefined;
    const streamOptions = {
      model,
      maxSteps,
      modelSettings: {
        frequencyPenalty,
        presencePenalty,
        maxRetries,
        maxOutputTokens: maxTokens,
        temperature,
        topK,
        topP,
      },
      instructions,
      requestContext: requestContextRecord,
      providerOptions: providerOptions as any,
      requireToolApproval,
      tracingOptions,
    };

    try {
      const result = await agent.sendMessage({
        message: clientMessageId
          ? { contents: messageContents, metadata: { [CLIENT_MESSAGE_ID_KEY]: clientMessageId } }
          : messageContents,
        resourceId: resourceId || agentId,
        threadId,
        ifIdle: {
          streamOptions: {
            ...signalContinuationOptions,
            requestContext: requestContextRecord,
            clientTools: resolvedClientTools,
          },
        },
      });
      const echoedSignalId =
        result.signal &&
        typeof result.signal === 'object' &&
        'id' in result.signal &&
        typeof result.signal.id === 'string'
          ? result.signal.id
          : resolvedSignalId;
      onSignalSent?.(echoedSignalId, getSignalPreview(coreUserMessages));
      if (pendingToolApprovalIdsRef.current.size > 0) {
        setIsRunning(false);
      }
    } catch (error) {
      if (isThreadSignalUnsupportedError(error)) {
        onSignalSent?.(resolvedSignalId, getSignalPreview(coreUserMessages));
        try {
          await agent.sendSignal({
            signal: {
              id: resolvedSignalId,
              type: 'user-message',
              contents: messageContents,
            },
            resourceId: resourceId || agentId,
            threadId,
            ifIdle: { streamOptions },
          });
          return;
        } catch (signalError) {
          onSignalEcho?.(resolvedSignalId);
          if (isThreadSignalUnsupportedError(signalError)) {
            markThreadSignalsUnsupported();
            setMessages(prev => [...prev, fromCoreUserMessagesToMastraDBMessage(coreUserMessages)]);
            await streamWithLegacyRoute();
            return;
          }
          throw signalError;
        }
      }
      throw error;
    }

    if (_streamAbortRef.current === internalAbort) {
      _streamAbortRef.current = null;
    }
  };

  const network = async ({
    coreUserMessages,
    model,
    requestContext,
    threadId,
    onNetworkChunk,
    modelSettings,
    signal,
    tracingOptions,
  }: NetworkArgs) => {
    const { frequencyPenalty, presencePenalty, maxRetries, maxTokens, temperature, topK, topP, maxSteps } =
      modelSettings || {};

    const resolvedRequestContext = requestContext ?? propsRequestContext;
    _activeContinuation.current = {
      model,
      requestContext: resolvedRequestContext,
    };
    setIsRunning(true);

    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    const runId = uuid();

    const response = await agent.network(coreUserMessages, {
      model,
      maxSteps,
      modelSettings: {
        frequencyPenalty,
        presencePenalty,
        maxRetries,
        maxOutputTokens: maxTokens,
        temperature,
        topK,
        topP,
      },
      runId,
      requestContext: resolvedRequestContext,
      ...(threadId ? { memory: { thread: threadId, resource: resourceId || agentId } } : {}),
      tracingOptions,
    });

    _onNetworkChunk.current = onNetworkChunk;
    _networkRunId.current = runId;

    // Accumulate network chunks into `messages` as `MastraDBMessage` (temporary
    // bridge until the next major), while still forwarding chunks to the
    // consumer for side-effects (OM, working memory, thread list, errors).
    await response.processDataStream({
      onChunk: async (chunk: NetworkChunkType) => {
        setMessages(prev => accumulateNetworkChunk({ chunk, conversation: prev, metadata: { mode: 'network' } }));
        void onNetworkChunk?.(chunk);
      },
    });

    setMessages(prev => finishStreamingAssistantMessage(prev));
    setIsRunning(false);
  };

  const handleCancelRun = () => {
    _streamAbortRef.current?.abort();
    _streamAbortRef.current = null;
    const threadSubscription = _threadSubscriptionRef.current;
    void Promise.resolve(threadSubscription?.abort?.()).catch(error => {
      console.error('[useChat] Failed to abort thread subscription', error);
    });
    closeThreadSubscription();
    setMessages(prev => finishStreamingAssistantMessage(prev));
    pendingToolApprovalIdsRef.current.clear();
    setIsAwaitingToolApproval(false);
    setIsRunning(false);
    _currentRunId.current = undefined;
    _onChunk.current = undefined;
    _networkRunId.current = undefined;
    _onNetworkChunk.current = undefined;
    _activeContinuation.current = {};
  };

  const approveToolCall = async (toolCallId: string, resumeData?: unknown) => {
    const onChunk = _onChunk.current;
    const currentRunId = _currentRunId.current;
    const continuation = _activeContinuation.current;

    if (!currentRunId)
      return console.info('[approveToolCall] approveToolCall can only be called after a stream has started');

    setIsRunning(true);
    setToolCallApprovals(prev => ({ ...prev, [toolCallId]: { status: 'approved' } }));

    const agent = baseClient.getAgent(agentId);
    if (_threadSubscriptionKeyRef.current && threadId) {
      try {
        await agent.sendToolApproval({
          resourceId: resourceId || agentId,
          threadId,
          toolCallId,
          approved: true,
          ...(continuation.model !== undefined ? { streamOptions: { model: continuation.model } } : {}),
          ...(resumeData !== undefined ? { resumeData } : {}),
          requestContext: continuation.requestContext,
        });
        pendingToolApprovalIdsRef.current.delete(toolCallId);
        setIsAwaitingToolApproval(pendingToolApprovalIdsRef.current.size > 0);
        setIsRunning(false);
      } catch (error) {
        setToolCallApprovals(prev => {
          const next = { ...prev };
          delete next[toolCallId];
          return next;
        });
        setIsRunning(false);
        throw error;
      }
      return;
    }

    const response = await agent.approveToolCall({
      runId: currentRunId,
      toolCallId,
      ...continuation,
    });

    await response.processDataStream({
      onChunk: async (chunk: ChunkType) => {
        await processStreamChunk(chunk, onChunk);
      },
    });
    setIsRunning(false);
  };

  const declineToolCall = async (toolCallId: string) => {
    const onChunk = _onChunk.current;
    const currentRunId = _currentRunId.current;
    const continuation = _activeContinuation.current;

    if (!currentRunId)
      return console.info('[declineToolCall] declineToolCall can only be called after a stream has started');

    setIsRunning(true);
    setToolCallApprovals(prev => ({ ...prev, [toolCallId]: { status: 'declined' } }));
    const agent = baseClient.getAgent(agentId);
    if (_threadSubscriptionKeyRef.current && threadId) {
      try {
        await agent.sendToolApproval({
          resourceId: resourceId || agentId,
          threadId,
          toolCallId,
          approved: false,
          ...(continuation.model !== undefined ? { streamOptions: { model: continuation.model } } : {}),
          requestContext: continuation.requestContext,
        });
        pendingToolApprovalIdsRef.current.delete(toolCallId);
        setIsAwaitingToolApproval(pendingToolApprovalIdsRef.current.size > 0);
        setIsRunning(false);
      } catch (error) {
        setToolCallApprovals(prev => {
          const next = { ...prev };
          delete next[toolCallId];
          return next;
        });
        setIsRunning(false);
        throw error;
      }
      return;
    }

    const response = await agent.declineToolCall({
      runId: currentRunId,
      toolCallId,
      ...continuation,
    });

    await response.processDataStream({
      onChunk: async (chunk: ChunkType) => {
        await processStreamChunk(chunk, onChunk);
      },
    });
    setIsRunning(false);
  };

  const approveToolCallGenerate = async (toolCallId: string) => {
    const currentRunId = _currentRunId.current;
    const continuation = _activeContinuation.current;

    if (!currentRunId)
      return console.info(
        '[approveToolCallGenerate] approveToolCallGenerate can only be called after a generate has started',
      );

    setIsRunning(true);
    setToolCallApprovals(prev => ({ ...prev, [toolCallId]: { status: 'approved' } }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.approveToolCallGenerate({
      runId: currentRunId,
      toolCallId,
      ...continuation,
    });

    if (response && 'uiMessages' in response.response && response.response.uiMessages) {
      const dbMessages = dbFromServerUiMessages(response.response.uiMessages, { mode: 'generate' });
      setMessages(prev => [...prev, ...dbMessages]);
    }

    setIsRunning(false);
  };

  const declineToolCallGenerate = async (toolCallId: string) => {
    const currentRunId = _currentRunId.current;
    const continuation = _activeContinuation.current;

    if (!currentRunId)
      return console.info(
        '[declineToolCallGenerate] declineToolCallGenerate can only be called after a generate has started',
      );

    setIsRunning(true);
    setToolCallApprovals(prev => ({ ...prev, [toolCallId]: { status: 'declined' } }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.declineToolCallGenerate({
      runId: currentRunId,
      toolCallId,
      ...continuation,
    });

    if (response && 'uiMessages' in response.response && response.response.uiMessages) {
      const dbMessages = dbFromServerUiMessages(response.response.uiMessages, { mode: 'generate' });
      setMessages(prev => [...prev, ...dbMessages]);
    }

    setIsRunning(false);
  };

  const approveNetworkToolCall = async (toolName: string, runId?: string) => {
    const onNetworkChunk = _onNetworkChunk.current;
    const networkRunId = runId || _networkRunId.current;
    const continuation = _activeContinuation.current;

    if (!networkRunId)
      return console.info(
        '[approveNetworkToolCall] approveNetworkToolCall can only be called after a network stream has started',
      );

    setIsRunning(true);
    setNetworkToolCallApprovals(prev => ({
      ...prev,
      [runId ? `${runId}-${toolName}` : toolName]: { status: 'approved' },
    }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.approveNetworkToolCall({
      runId: networkRunId,
      ...continuation,
    });

    await response.processDataStream({
      onChunk: async (chunk: NetworkChunkType) => {
        setMessages(prev => accumulateNetworkChunk({ chunk, conversation: prev, metadata: { mode: 'network' } }));
        void onNetworkChunk?.(chunk);
      },
    });

    setMessages(prev => finishStreamingAssistantMessage(prev));
    setIsRunning(false);
  };

  const declineNetworkToolCall = async (toolName: string, runId?: string) => {
    const onNetworkChunk = _onNetworkChunk.current;
    const networkRunId = runId || _networkRunId.current;
    const continuation = _activeContinuation.current;

    if (!networkRunId)
      return console.info(
        '[declineNetworkToolCall] declineNetworkToolCall can only be called after a network stream has started',
      );

    setIsRunning(true);
    setNetworkToolCallApprovals(prev => ({
      ...prev,
      [runId ? `${runId}-${toolName}` : toolName]: { status: 'declined' },
    }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.declineNetworkToolCall({
      runId: networkRunId,
      ...continuation,
    });

    await response.processDataStream({
      onChunk: async (chunk: NetworkChunkType) => {
        setMessages(prev => accumulateNetworkChunk({ chunk, conversation: prev, metadata: { mode: 'network' } }));
        void onNetworkChunk?.(chunk);
      },
    });

    setMessages(prev => finishStreamingAssistantMessage(prev));
    setIsRunning(false);
  };

  const sendMessage = async ({ mode = 'stream', ...args }: SendMessageArgs) => {
    const nextMessage: Omit<CoreUserMessage, 'id'> = { role: 'user', content: [{ type: 'text', text: args.message }] };
    const coreUserMessages = [nextMessage];

    if (args.coreUserMessages) {
      coreUserMessages.push(...args.coreUserMessages);
    }

    // The whole user turn (text + any attachments) is merged into a single
    // optimistic message so streaming renders one bubble, matching how
    // memory/reload resolves the persisted multi-part user message.
    const dbUserMessage = fromCoreUserMessagesToMastraDBMessage(coreUserMessages);
    const clientSetId =
      mode === 'stream' && args.threadId && !_threadSignalsUnsupportedRef.current && !threadSignalsDisabled
        ? `client-set-${uuid()}`
        : undefined;
    const signalId = clientSetId;
    const clientMessageId = clientSetId;

    if (signalId) {
      // Signal path: append the user turn optimistically as `pending` with a
      // visibly client-owned id. The server echo can replace the final message
      // id while the matching client id reconciles the pending bubble.
      const metadata: MastraDBMessageMetadata = {
        ...dbUserMessage.content.metadata,
        mode: 'stream',
        status: 'pending',
        [CLIENT_MESSAGE_ID_KEY]: clientMessageId,
      };
      const pendingMessage = { ...dbUserMessage, id: clientSetId, content: { ...dbUserMessage.content, metadata } };
      setMessages(s => [...s, pendingMessage]);
    } else {
      setMessages(s => [...s, dbUserMessage]);
    }

    try {
      if (mode === 'generate') {
        await generate({ ...args, coreUserMessages });
      } else if (mode === 'stream') {
        await stream({ ...args, coreUserMessages, signalId, clientMessageId });
      } else if (mode === 'network') {
        await network({ ...args, coreUserMessages });
      }
    } catch (error) {
      // A failed send (subscription setup, request, or stream) must not leave
      // the chat stranded in a "running" state until reload (issue #18768).
      setIsRunning(false);
      throw error;
    }
  };

  return {
    setMessages,
    sendMessage,
    isRunning,
    isAwaitingToolApproval,
    messages,
    tasks,
    approveToolCall,
    declineToolCall,
    approveToolCallGenerate,
    declineToolCallGenerate,
    cancelRun: handleCancelRun,
    toolCallApprovals,
    approveNetworkToolCall,
    declineNetworkToolCall,
    networkToolCallApprovals,
  };
};
