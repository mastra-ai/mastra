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

const extractPendingToolApprovalIdsFromMessages = (messages: MastraDBMessage[], runId?: string) => {
  const pendingToolApprovalIds = new Set<string>();

  for (const message of messages) {
    const metadata = message.content?.metadata as MastraDBMessageMetadata | undefined;
    if (!metadata) continue;

    const metadataSources = [
      metadata.pendingToolApprovals,
      metadata.requireApprovalMetadata,
      metadata.suspendedTools,
    ] as Array<Record<string, { toolCallId?: unknown; runId?: unknown }> | undefined>;

    for (const source of metadataSources) {
      if (!source || typeof source !== 'object') continue;

      for (const suspensionData of Object.values(source)) {
        if (runId && suspensionData?.runId !== runId) continue;
        const toolCallId = suspensionData?.toolCallId;
        if (typeof toolCallId === 'string' && toolCallId.length > 0) {
          pendingToolApprovalIds.add(toolCallId);
        }
      }
    }
  }

  return pendingToolApprovalIds;
};

const isWaitingQueuedMessage = (message: MastraDBMessage): boolean =>
  message.content.metadata?.deliveryState === 'queueing' || message.content.metadata?.deliveryState === 'queued';

const placeQueuedTurnBeforeResponse = (
  messages: MastraDBMessage[],
  clientMessageId: string,
  runId: string,
): MastraDBMessage[] => {
  const messageIndex = messages.findIndex(
    message => message.content.metadata?.[CLIENT_MESSAGE_ID_KEY] === clientMessageId,
  );
  const responseIndex = messages.findIndex(
    message => message.role === 'assistant' && message.content.metadata?.deliveryRunId === runId,
  );
  if (responseIndex < 0 || messageIndex <= responseIndex) return messages;
  const reordered = [...messages];
  const [message] = reordered.splice(messageIndex, 1);
  if (message) reordered.splice(responseIndex, 0, message);
  return reordered;
};

const toolCallHasOutput = (parts: MastraDBMessage['content']['parts'], toolCallId: string): boolean =>
  parts.some(part => {
    if (part.type !== 'tool-invocation') return false;
    const invocation = (part as MastraToolInvocationPart).toolInvocation;
    if (invocation.toolCallId !== toolCallId) return false;
    return invocation.state === 'result' || (invocation as { result?: unknown }).result != null;
  });

const filterUnresolvedApprovals = <T extends { toolCallId: string }>(
  entries: Record<string, T> | undefined,
  parts: MastraDBMessage['content']['parts'],
): Record<string, T> | undefined => {
  if (!entries || typeof entries !== 'object') return undefined;
  const pending = Object.fromEntries(
    Object.entries(entries).filter(
      ([, approval]) =>
        approval &&
        typeof approval === 'object' &&
        typeof approval.toolCallId === 'string' &&
        !toolCallHasOutput(parts, approval.toolCallId),
    ),
  );
  return Object.keys(pending).length ? pending : undefined;
};

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
      if (
        !normalizedMetadata?.pendingToolApprovals &&
        !normalizedMetadata?.requireApprovalMetadata &&
        !normalizedMetadata?.suspendedTools
      ) {
        return normalizedMessage;
      }

      const { pendingToolApprovals, requireApprovalMetadata, suspendedTools, ...restMetadata } = normalizedMetadata;
      const parts = normalizedMessage.content.parts;
      const pending = filterUnresolvedApprovals(pendingToolApprovals, parts);
      const required = { ...filterUnresolvedApprovals(requireApprovalMetadata, parts), ...pending };
      const suspended = filterUnresolvedApprovals(suspendedTools, parts);

      return {
        ...normalizedMessage,
        content: {
          ...normalizedMessage.content,
          metadata: {
            ...restMetadata,
            ...(pendingToolApprovals ? { mode: 'stream' as const } : {}),
            ...(pending ? { pendingToolApprovals: pending } : {}),
            ...(Object.keys(required).length ? { requireApprovalMetadata: required } : {}),
            ...(suspended ? { suspendedTools: suspended } : {}),
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
  system?: ModelSettings['system'];
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
  /** Queue a separate turn, or explicitly steer the active run. Defaults to send (deliver). */
  delivery?: 'send' | 'queue' | 'steer';
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
  const liveTasks = useRef<TaskItem[] | undefined>(undefined);
  const [toolCallApprovals, setToolCallApprovals] = useState<{
    [toolCallId: string]: { status: 'approved' | 'declined' };
  }>({});
  const [networkToolCallApprovals, setNetworkToolCallApprovals] = useState<{
    [toolName: string]: { status: 'approved' | 'declined' };
  }>({});
  const pendingToolApprovalIdsRef = useRef(new Set<string>());
  const liveApprovalIds = useRef(new Set<string>());
  const liveRunId = useRef<string | undefined>(undefined);
  const liveRunFinished = useRef(false);
  const [isAwaitingToolApproval, setIsAwaitingToolApproval] = useState(false);

  const baseClient = useMastraClient();
  const [isRunning, setIsRunning] = useState(false);

  const observedRuns = useRef(new Map<string, 'sent' | 'failed'>());
  const finishedRuns = useRef(new Set<string>());
  const lastHydration = useRef<
    | {
        agentId: string;
        resourceId?: string;
        threadId?: string;
        initialMessages: MastraChatProps['initialMessages'];
        formattedMessages: MastraDBMessage[];
      }
    | undefined
  >(undefined);

  useEffect(() => {
    const previous = lastHydration.current;
    const sameThread =
      previous?.agentId === agentId && previous.resourceId === resourceId && previous.threadId === threadId;
    if (sameThread && previous.initialMessages === initialMessages) return;
    const formattedMessages = resolveInitialMessages(initialMessages ?? []);
    lastHydration.current = { agentId, resourceId, threadId, initialMessages, formattedMessages };

    if (sameThread) {
      // Accumulation replaces changed messages immutably. Keep those local edits
      // over history snapshots, even if the request returns after the run finishes.
      const previousById = new Map(previous.formattedMessages.map(message => [message.id, message]));
      setMessages(current => {
        const live = current.filter(message => previousById.get(message.id) !== message);
        const liveById = new Map(live.map(message => [message.id, message]));
        const historyIds = new Set(formattedMessages.map(message => message.id));
        const historyClientIds = new Set(
          (initialMessages ?? [])
            .map(message => message.content.metadata?.[CLIENT_MESSAGE_ID_KEY])
            .filter(id => typeof id === 'string'),
        );
        const reconciled = [
          ...formattedMessages.map(message => liveById.get(message.id) ?? message),
          ...live.filter(message => {
            const clientId = message.content.metadata?.[CLIENT_MESSAGE_ID_KEY];
            return !historyIds.has(message.id) && !(typeof clientId === 'string' && historyClientIds.has(clientId));
          }),
        ];
        return [
          ...reconciled.filter(message => !isWaitingQueuedMessage(message)),
          ...reconciled.filter(isWaitingQueuedMessage),
        ];
      });
      setTasks(liveTasks.current ?? extractLatestTasksFromMessages(formattedMessages));
      // History may arrive before the live approval event, but must not undo
      // a live approval decision or terminal event, nor switch the active run.
      const historyRunId = extractRunIdFromMessages(formattedMessages);
      if (liveRunFinished.current) return;
      if (!liveRunId.current && isRunning && historyRunId !== _currentRunId.current) return;
    } else {
      observedRuns.current.clear();
      finishedRuns.current.clear();
      liveTasks.current = undefined;
      liveApprovalIds.current.clear();
      liveRunId.current = undefined;
      liveRunFinished.current = false;
      if (previous) setIsRunning(false);
      setMessages(formattedMessages);
      setTasks(extractLatestTasksFromMessages(formattedMessages));
    }
    const pendingApprovals = extractPendingToolApprovalIdsFromMessages(formattedMessages, liveRunId.current);
    for (const toolCallId of liveApprovalIds.current) {
      if (pendingToolApprovalIdsRef.current.has(toolCallId)) pendingApprovals.add(toolCallId);
      else pendingApprovals.delete(toolCallId);
    }
    pendingToolApprovalIdsRef.current = pendingApprovals;
    setIsAwaitingToolApproval(pendingApprovals.size > 0);
    _currentRunId.current = liveRunId.current ?? extractRunIdFromMessages(formattedMessages);
  }, [agentId, resourceId, threadId, initialMessages, isRunning, isAwaitingToolApproval]);

  useEffect(() => {
    _activeContinuation.current = {
      ..._activeContinuation.current,
      requestContext: propsRequestContext,
    };
  }, [propsRequestContext]);

  type SignalContentPart =
    | { type: 'text'; text: string }
    | { type: 'file'; data: string; mediaType: string; filename?: string };
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
      const isTerminal = chunk.type === 'finish' || chunk.type === 'abort' || chunk.type === 'error';
      const isOtherRunTerminal = isTerminal && liveRunId.current && chunk.runId !== liveRunId.current;
      if (
        chunk.type === 'start' &&
        !(typeof chunk.payload.messageId === 'string' && chunk.payload.messageId.startsWith('persisted-signal:'))
      ) {
        observedRuns.current.set(chunk.runId, 'sent');
      }
      if ((chunk.type === 'error' || chunk.type === 'abort') && !observedRuns.current.has(chunk.runId)) {
        observedRuns.current.set(chunk.runId, 'failed');
      }
      if (chunk.type === 'finish' || chunk.type === 'error' || chunk.type === 'abort') {
        finishedRuns.current.add(chunk.runId);
      }
      const echoMetadata = chunk.type === 'data-user-message' && isDataChunk(chunk) ? chunk.data?.metadata : undefined;
      const echoedClientId =
        echoMetadata && typeof echoMetadata === 'object' && CLIENT_MESSAGE_ID_KEY in echoMetadata
          ? echoMetadata[CLIENT_MESSAGE_ID_KEY]
          : undefined;
      setMessages(prev => {
        const conversation = prev.map(message => {
          const metadata = message.content.metadata;
          if (
            isWaitingQueuedMessage(message) &&
            typeof echoedClientId === 'string' &&
            metadata?.[CLIENT_MESSAGE_ID_KEY] === echoedClientId
          ) {
            return {
              ...message,
              content: {
                ...message.content,
                metadata: { ...metadata, deliveryState: 'sent', deliveryRunId: chunk.runId },
              },
            };
          }
          if (typeof metadata?.deliveryRunId !== 'string') return message;
          let deliveryState: MastraDBMessageMetadata['deliveryState'];
          if (metadata.deliveryState === 'queued') deliveryState = observedRuns.current.get(metadata.deliveryRunId);
          if (metadata.deliveryState === 'steered' && finishedRuns.current.has(metadata.deliveryRunId))
            deliveryState = 'sent';
          if (!deliveryState) return message;
          return {
            ...message,
            content: {
              ...message.content,
              metadata: {
                ...metadata,
                deliveryState,
                status: deliveryState === 'failed' ? undefined : metadata.status,
              },
            },
          };
        });
        const waiting = conversation.filter(isWaitingQueuedMessage);
        const active = conversation.filter(message => !isWaitingQueuedMessage(message));
        const promotesQueuedTurn = prev.some(
          message =>
            isWaitingQueuedMessage(message) && message.content.metadata?.[CLIENT_MESSAGE_ID_KEY] === echoedClientId,
        );
        const ordered =
          promotesQueuedTurn && typeof echoedClientId === 'string'
            ? placeQueuedTurnBeforeResponse(active, echoedClientId, chunk.runId)
            : active;
        const tail = ordered.at(-1);
        // A startup echo confirms the user message; it must not discard the run's response ID.
        const startupResponse =
          chunk.type === 'data-user-message' &&
          tail?.role === 'assistant' &&
          tail.content.parts.length === 0 &&
          tail.content.metadata?.deliveryRunId === chunk.runId
            ? tail
            : undefined;
        return [
          ...(isOtherRunTerminal
            ? ordered
            : accumulateChunk({
                chunk,
                conversation: startupResponse ? ordered.slice(0, -1) : ordered,
                metadata: { mode: 'stream', deliveryRunId: chunk.runId },
              })),
          ...(startupResponse ? [startupResponse] : []),
          ...waiting,
        ];
      });
      // Other runs can settle delivery feedback, but must not finish the active
      // response, clear its approvals, or trigger its completion callback.
      if (isOtherRunTerminal) return;

      const streamedTasks = extractTasksFromToolResultChunk(chunk) ?? extractTasksFromSignalChunk(chunk);
      if (streamedTasks !== undefined) {
        liveTasks.current = streamedTasks;
        setTasks(streamedTasks);
      }

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
          if (liveRunId.current !== chunk.runId) liveApprovalIds.current.clear();
          liveRunFinished.current = false;
          liveRunId.current = chunk.runId;
          _currentRunId.current = chunk.runId;
        }
      }

      if (chunk.type === 'tool-call-approval' || chunk.type === 'tool-call-suspended') {
        const toolCallId = chunk.payload?.toolCallId;
        if (typeof toolCallId === 'string') {
          liveApprovalIds.current.add(toolCallId);
          pendingToolApprovalIdsRef.current.add(toolCallId);
          setIsAwaitingToolApproval(true);
        }
        setIsRunning(false);
      }

      if (isTerminal) {
        if (chunk.runId === liveRunId.current) liveRunFinished.current = true;
        for (const toolCallId of pendingToolApprovalIdsRef.current) liveApprovalIds.current.add(toolCallId);
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
      system,
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
      system,
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
    delivery = 'send',
  }: StreamArgs) => {
    const activeRunAtSend = isRunning || isAwaitingToolApproval ? _currentRunId.current : undefined;
    const {
      frequencyPenalty,
      presencePenalty,
      maxRetries,
      maxTokens,
      temperature,
      topK,
      topP,
      instructions,
      system,
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
      system,
      providerOptions,
      requireToolApproval,
      tracingOptions,
    };
    _activeContinuation.current = {
      model,
      requestContext: resolvedRequestContext,
    };
    setIsRunning(true);

    if (!threadId || _threadSignalsUnsupportedRef.current || threadSignalsDisabled) {
      _streamAbortRef.current?.abort();
    }
    const internalAbort = new AbortController();

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
      _streamAbortRef.current = internalAbort;
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
        system,
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
      if (delivery === 'queue') throw new Error('Queueing requires thread signal support. The message was not sent.');
      await streamWithLegacyRoute();
      return;
    }

    _onChunk.current = onChunk;

    await ensureThreadSubscription({ threadId, resourceId: resourceId || agentId });

    if (_threadSignalsUnsupportedRef.current) {
      if (delivery === 'queue') throw new Error('Queueing requires thread signal support. The message was not sent.');
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
      system,
      requestContext: requestContextRecord,
      providerOptions: providerOptions as any,
      requireToolApproval,
      tracingOptions,
    };

    try {
      const result = await agent[delivery === 'queue' ? 'queueMessage' : 'sendMessage']({
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
      if (clientMessageId && delivery !== 'send') {
        setMessages(prev => {
          const updated = prev.map(message => {
            if (message.content.metadata?.[CLIENT_MESSAGE_ID_KEY] !== clientMessageId) return message;
            let deliveryState: MastraDBMessageMetadata['deliveryState'] = 'sent';
            if (delivery === 'queue') deliveryState = observedRuns.current.get(result.runId) ?? 'queued';
            else if (activeRunAtSend === result.runId && !finishedRuns.current.has(result.runId))
              deliveryState = 'steered';
            return {
              ...message,
              content: {
                ...message.content,
                metadata: {
                  ...message.content.metadata,
                  deliveryState,
                  deliveryRunId: result.runId,
                  status:
                    deliveryState === 'failed' || finishedRuns.current.has(result.runId)
                      ? undefined
                      : message.content.metadata?.status,
                },
              },
            };
          });
          if (delivery === 'queue' && observedRuns.current.has(result.runId)) {
            return placeQueuedTurnBeforeResponse(updated, clientMessageId, result.runId);
          }
          return updated;
        });
      }
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
      // A requested queue must never silently fall back to steering the active run.
      if (delivery === 'queue') throw error;
      if (isThreadSignalUnsupportedError(error)) {
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
          onSignalSent?.(resolvedSignalId, getSignalPreview(coreUserMessages));
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
    // Stop execution, not observation: independently queued turns can still start.
    const cancelledRunId = _currentRunId.current;
    if (cancelledRunId) finishedRuns.current.add(cancelledRunId);
    setMessages(prev =>
      finishStreamingAssistantMessage(
        prev.map(message => {
          const metadata = message.content.metadata;
          if (!cancelledRunId || metadata?.deliveryState !== 'steered' || metadata.deliveryRunId !== cancelledRunId)
            return message;
          return { ...message, content: { ...message.content, metadata: { ...metadata, deliveryState: 'sent' } } };
        }),
      ),
    );
    liveRunFinished.current = true;
    pendingToolApprovalIdsRef.current.clear();
    setIsAwaitingToolApproval(false);
    setIsRunning(false);
    _currentRunId.current = undefined;
    _networkRunId.current = undefined;
    _onNetworkChunk.current = undefined;
    if (!threadSubscription) {
      _onChunk.current = undefined;
      _activeContinuation.current = {};
    }
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
        liveRunId.current ??= currentRunId;
        liveApprovalIds.current.add(toolCallId);
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

    try {
      const response =
        resumeData !== undefined
          ? await agent.resumeStream(resumeData as Parameters<typeof agent.resumeStream>[0], {
              runId: currentRunId,
              toolCallId,
              ...continuation,
            })
          : await agent.approveToolCall({
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
    } catch (error) {
      setToolCallApprovals(prev => {
        const next = { ...prev };
        delete next[toolCallId];
        return next;
      });
      setIsRunning(false);
      throw error;
    }
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
        liveRunId.current ??= currentRunId;
        liveApprovalIds.current.add(toolCallId);
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
        ...(mode === 'stream' && 'delivery' in args && args.delivery === 'queue'
          ? { deliveryState: 'queueing' as const }
          : {}),
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
      if (!isRunning) setIsRunning(false);
      // An aborted acceptance request has an unknown outcome; a later echo can still confirm it.
      if (clientMessageId && !isAbortError(error)) {
        setMessages(prev =>
          prev.map(message =>
            message.content.metadata?.[CLIENT_MESSAGE_ID_KEY] === clientMessageId
              ? {
                  ...message,
                  content: {
                    ...message.content,
                    metadata: { ...message.content.metadata, status: undefined, deliveryState: 'failed' },
                  },
                }
              : message,
          ),
        );
      }
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
