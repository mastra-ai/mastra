import type {
  AIV5Type,
  MastraDBMessage,
  MastraMessagePart,
  MastraMessageContentV2,
  MastraToolInvocation,
  MastraToolInvocationPart,
} from '@mastra/core/agent/message-list';
import type { AgentChunkType, ChunkType, NetworkChunkType } from '@mastra/core/stream';
import type { WorkflowStreamResult, StepResult } from '@mastra/core/workflows';
import { uint8ArrayToBase64, encodeFilePartDataForStorage } from '../../agent/signal-data';
import { formatCompletionFeedback, formatStreamCompletionFeedback } from './formatCompletionFeedback';
import { CLIENT_MESSAGE_ID_KEY } from './types';
import type {
  BackgroundTaskEntry,
  MastraDBMessageMetadata,
  MastraProviderMetadata,
  MastraReasoningPart,
  MastraTextPart,
} from './types';

// Boundary cast policy
// --------------------
// `MastraMessagePart` (from @mastra/core) is V4-shaped:
//   - text/reasoning parts have no `state`, `textId`, `reasoningId`, or `redacted`
//   - the V4 reasoning part requires a `details` array we do not synthesize
//   - file parts use the canonical DB shape `{ mimeType, data }` so MessageList /
//     `toAISdkMessages` adapters can read them (V5-shaped `{ mediaType, url }`
//     only survives conversion on the way *out* to AI SDK UI parts)
//   - V4 source parts wrap a `LanguageModelV1Source` object; we emit V5-shaped
//     flat `source-url` / `source-document` parts
//
// The React SDK targets AI SDK v5 only, so the accumulator stores a V5-flavored
// superset of `MastraMessagePart`. Every `as unknown as MastraMessagePart` site
// in this file is a deliberate storage-boundary cast for one of the above
// extensions, not an accident. Downstream consumers (`toAISdkV5Messages`,
// playground `to-assistant-ui-message`) read the V5 fields directly.

type StreamChunk = {
  type: string;
  payload: any;
  runId: string;
  from: 'AGENT' | 'WORKFLOW';
};

const cloneMetadata = (metadata: MastraDBMessageMetadata | undefined): MastraDBMessageMetadata =>
  metadata ? { ...metadata } : {};

const withParts = (message: MastraDBMessage, parts: MastraMessagePart[]): MastraDBMessage => ({
  ...message,
  content: {
    ...message.content,
    parts,
  },
});

const withMetadata = (message: MastraDBMessage, metadata: MastraDBMessageMetadata): MastraDBMessage => ({
  ...message,
  content: {
    ...message.content,
    metadata,
  },
});

// Drops the transient `pending` status and the `clientMessageId` correlation
// key from an optimistic user message once its server echo confirms it, leaving
// the rest of the metadata intact.
const clearPendingStatus = (message: MastraDBMessage): MastraDBMessage => {
  const { status: _status, [CLIENT_MESSAGE_ID_KEY]: _clientMessageId, ...rest } = message.content.metadata ?? {};
  return withMetadata(message, rest);
};

// Like `clearPendingStatus` but retains the `clientMessageId` correlation key.
// Used during `data-user-message` reconciliation so the rendered row key (which
// prefers `clientMessageId`) stays stable across the id swap, preventing a
// React unmount/remount and the resulting layout shift. `clientMessageId` is
// still stripped from persisted threads by `resolveInitialMessages`.
const clearPendingStatusKeepClientId = (message: MastraDBMessage): MastraDBMessage => {
  const { status: _status, ...rest } = message.content.metadata ?? {};
  return withMetadata(message, rest);
};

const replaceLast = (conversation: MastraDBMessage[], message: MastraDBMessage): MastraDBMessage[] => [
  ...conversation.slice(0, -1),
  message,
];

const replaceAt = (conversation: MastraDBMessage[], index: number, message: MastraDBMessage): MastraDBMessage[] => [
  ...conversation.slice(0, index),
  message,
  ...conversation.slice(index + 1),
];

const newAssistantMessage = (
  id: string,
  parts: MastraMessagePart[],
  metadata: MastraDBMessageMetadata,
): MastraDBMessage => ({
  id,
  role: 'assistant',
  createdAt: new Date(),
  content: {
    format: 2,
    parts,
    metadata: cloneMetadata(metadata),
  } satisfies MastraMessageContentV2,
});

const appendAssistantMessage = (
  conversation: MastraDBMessage[],
  id: string,
  parts: MastraMessagePart[],
  metadata: MastraDBMessageMetadata,
): MastraDBMessage[] => [...conversation, newAssistantMessage(id, parts, metadata)];

const isToolPart = (part: MastraMessagePart): part is MastraToolInvocationPart => part.type === 'tool-invocation';

const partTextId = (part: MastraMessagePart): string | undefined =>
  part.type === 'text' ? (part as MastraTextPart).textId : undefined;

const partState = (part: MastraMessagePart): string | undefined => (part as { state?: string }).state;

const partProviderMetadata = (part: MastraMessagePart): Record<string, unknown> | undefined =>
  (part as { providerMetadata?: Record<string, unknown> }).providerMetadata;

/**
 * Set any streaming text/reasoning parts on the trailing assistant message to
 * `state: 'done'`. Mirrors the previous `finishStreamingAssistantMessage` from
 * the AI-SDK accumulator.
 */
export const finishStreamingAssistantMessage = (conversation: MastraDBMessage[]): MastraDBMessage[] => {
  const lastMessage = conversation[conversation.length - 1];
  if (!lastMessage || lastMessage.role !== 'assistant') return conversation;
  if (lastMessage.content.parts.length === 0) return conversation.slice(0, -1);

  const nextParts = lastMessage.content.parts.map(part => {
    if ((part.type === 'text' || part.type === 'reasoning') && partState(part) === 'streaming') {
      return {
        ...(part as MastraTextPart | MastraReasoningPart),
        state: 'done' as const,
      } as unknown as MastraMessagePart;
    }
    return part;
  });

  return replaceLast(conversation, withParts(lastMessage, nextParts));
};

/**
 * Locate the assistant message + tool part owning `toolCallId`. Prefers the
 * most recent assistant message and walks back up to 10 messages, matching the
 * historical accumulator's lookup behavior.
 */
const locateToolPart = (
  messages: MastraDBMessage[],
  toolCallId: string,
  allowMetadataOnlyMatch: boolean,
): { messageIndex: number; toolPartIndex: number } | null => {
  const findIndex = (parts: MastraMessagePart[]) =>
    parts.findIndex(part => isToolPart(part) && part.toolInvocation.toolCallId === toolCallId);

  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.role === 'assistant') {
    const idx = findIndex(lastMessage.content.parts);
    if (idx !== -1) return { messageIndex: messages.length - 1, toolPartIndex: idx };
  }

  let count = 0;
  const maxMessagesBack = 10;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (count > maxMessagesBack) break;
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    const idx = findIndex(message.content.parts);
    if (idx !== -1) return { messageIndex: i, toolPartIndex: idx };
    count++;
  }

  if (!allowMetadataOnlyMatch) return null;

  // Fall back to most-recent assistant message for metadata-only updates.
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return { messageIndex: i, toolPartIndex: -1 };
  }
  return null;
};

/**
 * Merge per-toolCallId background-task bookkeeping onto message metadata.
 */
const mergeBgTaskMetadata = (
  existing: MastraDBMessageMetadata | undefined,
  mode: 'stream' | 'generate' | 'network' | undefined,
  args: {
    resetRunningCount?: boolean;
    perTaskEntry?: {
      toolCallId: string;
      startedAt?: Date;
      completedAt?: Date;
      suspendedAt?: Date;
      taskId: string;
    };
  },
  otherMetadata?: MastraDBMessageMetadata,
): MastraDBMessageMetadata => {
  const base = cloneMetadata(existing);
  const existingBgTasks = (base.backgroundTasks ?? {}) as Record<string, BackgroundTaskEntry>;

  const nextBgTasks: Record<string, BackgroundTaskEntry> = { ...existingBgTasks };
  if (args.perTaskEntry) {
    const { toolCallId, startedAt, completedAt, taskId, suspendedAt } = args.perTaskEntry;
    const prev = existingBgTasks[toolCallId] ?? ({ taskId } as BackgroundTaskEntry);
    nextBgTasks[toolCallId] = {
      ...prev,
      taskId,
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(suspendedAt !== undefined ? { suspendedAt } : {}),
    };
  }

  const merged: MastraDBMessageMetadata = {
    ...base,
    ...(otherMetadata ?? {}),
    mode,
    backgroundTasks: nextBgTasks,
  };
  if (args.resetRunningCount) merged.runningBackgroundTasksCount = undefined;
  return merged;
};

/**
 * Workflow chunk accumulation. Mirrors
 * `mapWorkflowStreamChunkToWatchResult` from the previous accumulator.
 */
export const mapWorkflowStreamChunkToWatchResult = (
  prev: WorkflowStreamResult<any, any, any, any>,
  chunk: StreamChunk,
): WorkflowStreamResult<any, any, any, any> => {
  if (chunk.type === 'workflow-start') {
    return {
      input: prev?.input,
      status: 'running',
      steps: prev?.steps || {},
    };
  }

  if (chunk.type === 'workflow-canceled') {
    return { ...prev, status: 'canceled' };
  }

  if (chunk.type === 'workflow-finish') {
    const finalStatus = chunk.payload.workflowStatus;
    const prevSteps = prev?.steps ?? {};
    const lastStep = Object.values(prevSteps).pop();
    return {
      ...prev,
      status: chunk.payload.workflowStatus,
      ...(finalStatus === 'success' && chunk.payload.finalWorkflowResult !== undefined
        ? { result: chunk.payload.finalWorkflowResult }
        : finalStatus === 'success' && lastStep?.status === 'success'
          ? { result: lastStep?.output }
          : finalStatus === 'failed' && lastStep?.status === 'failed'
            ? { error: lastStep?.error }
            : finalStatus === 'tripwire' && chunk.payload.tripwire
              ? { tripwire: chunk.payload.tripwire }
              : {}),
    };
  }

  const { stepCallId: _stepCallId, stepName: _stepName, ...newPayload } = chunk.payload ?? {};
  const newSteps = {
    ...prev?.steps,
    [chunk.payload.id]: {
      ...prev?.steps?.[chunk.payload.id],
      ...newPayload,
    },
  };

  if (chunk.type === 'workflow-step-start') return { ...prev, steps: newSteps };

  if (chunk.type === 'workflow-step-suspended') {
    const suspendedStepIds = Object.entries(newSteps as Record<string, StepResult<any, any, any, any>>).flatMap(
      ([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.suspendPayload?.__workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }
        return [];
      },
    );
    return {
      ...prev,
      status: 'suspended',
      steps: newSteps,
      suspendPayload: chunk.payload.suspendPayload,
      suspended: suspendedStepIds as any,
    };
  }

  if (chunk.type === 'workflow-step-waiting') return { ...prev, status: 'waiting', steps: newSteps };

  if (chunk.type === 'workflow-step-progress') {
    return {
      ...prev,
      steps: {
        ...prev?.steps,
        [chunk.payload.id]: {
          ...prev?.steps?.[chunk.payload.id],
          foreachProgress: {
            completedCount: chunk.payload.completedCount,
            totalCount: chunk.payload.totalCount,
            currentIndex: chunk.payload.currentIndex,
            iterationStatus: chunk.payload.iterationStatus,
            iterationOutput: chunk.payload.iterationOutput,
          },
        },
      },
    };
  }

  if (chunk.type === 'workflow-step-result') return { ...prev, steps: newSteps };

  return prev;
};

const signalContentsToUserMessages = (contents: unknown, metadata: MastraDBMessageMetadata): MastraDBMessage[] => {
  const makeUserMessage = (parts: MastraMessagePart[]): MastraDBMessage => ({
    id: `signal-${Date.now()}`,
    role: 'user',
    createdAt: new Date(),
    content: {
      format: 2,
      parts,
      metadata: cloneMetadata(metadata),
    },
  });

  const toMessagePart = (part: unknown): MastraMessagePart[] => {
    if (!part || typeof part !== 'object') return [];
    const typedPart = part as Record<string, unknown>;

    if (typedPart.type === 'text' && typeof typedPart.text === 'string') {
      return [{ type: 'text', text: typedPart.text }];
    }

    if (typedPart.type === 'image') {
      const image = typedPart.image;
      const mimeType =
        typeof typedPart.mediaType === 'string'
          ? typedPart.mediaType
          : typeof typedPart.mimeType === 'string'
            ? typedPart.mimeType
            : 'image/*';
      if (
        typeof image === 'string' ||
        image instanceof URL ||
        image instanceof ArrayBuffer ||
        image instanceof Uint8Array
      ) {
        return [
          {
            type: 'file',
            mimeType,
            data: encodeFilePartDataForStorage(image, mimeType),
          },
        ];
      }
      return [{ type: 'file', mimeType, data: '' }];
    }

    if (typedPart.type === 'file') {
      const data = typedPart.data;
      const mimeType =
        typeof typedPart.mediaType === 'string'
          ? typedPart.mediaType
          : typeof typedPart.mimeType === 'string'
            ? typedPart.mimeType
            : 'application/octet-stream';
      if (
        typeof data === 'string' ||
        data instanceof URL ||
        data instanceof ArrayBuffer ||
        data instanceof Uint8Array
      ) {
        return [
          {
            type: 'file',
            mimeType,
            data: encodeFilePartDataForStorage(data, mimeType),
            ...(typeof typedPart.filename === 'string' ? { filename: typedPart.filename } : {}),
          },
        ];
      }
      const urlFallback = typeof typedPart.url === 'string' ? typedPart.url : '';
      return [
        {
          type: 'file',
          mimeType,
          data: urlFallback,
          ...(typeof typedPart.filename === 'string' ? { filename: typedPart.filename } : {}),
        },
      ];
    }

    return [];
  };

  if (typeof contents === 'string') {
    return [makeUserMessage([{ type: 'text', text: contents }])];
  }

  if (Array.isArray(contents)) {
    const parts = contents.flatMap(toMessagePart);
    return parts.length
      ? [makeUserMessage(parts)]
      : contents.flatMap(content => signalContentsToUserMessages(content, metadata));
  }

  if (!contents || typeof contents !== 'object') return [];

  const message = contents as { role?: unknown; content?: unknown };
  if (message.role && message.role !== 'user') return [];

  const content = message.content;
  if (typeof content === 'string') {
    return [makeUserMessage([{ type: 'text', text: content }])];
  }

  if (!Array.isArray(content)) return [];

  const parts = content.flatMap(toMessagePart);
  return parts.length ? [makeUserMessage(parts)] : [];
};

const reconcilePendingUserEcho = (
  message: MastraDBMessage,
  echoedContents: unknown,
  metadata: MastraDBMessageMetadata,
  options: { signalId?: string; keepClientMessageId: boolean },
): MastraDBMessage => {
  const echoedMessages = signalContentsToUserMessages(echoedContents, metadata);
  const echoedParts = echoedMessages[0]?.content.parts;
  let reconciled = typeof options.signalId === 'string' ? { ...message, id: options.signalId } : message;
  if (echoedParts?.length) {
    reconciled = { ...reconciled, content: { ...reconciled.content, parts: echoedParts } };
  }
  return options.keepClientMessageId ? clearPendingStatusKeepClientId(reconciled) : clearPendingStatus(reconciled);
};

const makeToolInvocationPart = (invocation: MastraToolInvocation): MastraToolInvocationPart => ({
  type: 'tool-invocation',
  toolInvocation: invocation,
});

/**
 * Narrow the chunk to the template-literal passthrough variants from
 * `NetworkChunkType`. Encoded as a type guard so the surrounding `switch`
 * statement can stay exhaustive over the remaining string-literal cases.
 */
const isTemplateLiteralPassthrough = <T extends { type: string }>(
  chunk: T,
): chunk is T & { type: `agent-execution-event-${string}` | `workflow-execution-event-${string}` } =>
  chunk.type.startsWith('agent-execution-event-') || chunk.type.startsWith('workflow-execution-event-');

/**
 * Narrow the chunk to the `data-${string}` family. Used so the trailing
 * exhaustiveness check can prove the switch covers every remaining variant.
 */
const isDataChunk = <T extends { type: string }>(chunk: T): chunk is T & { type: `data-${string}` } =>
  chunk.type.startsWith('data-');

export interface AccumulateChunkArgs {
  chunk: ChunkType;
  conversation: MastraDBMessage[];
  metadata: MastraDBMessageMetadata;
}

/**
 * Reduce a single stream chunk into the running `MastraDBMessage[]`
 * conversation. The accumulator owns the entire chunk→DB mapping for the
 * React SDK; consumers downstream (e.g. `toAISdkV5Messages` in the playground)
 * translate the result into AI SDK / assistant-ui shapes as needed.
 */
export const accumulateChunk = ({ chunk, conversation, metadata }: AccumulateChunkArgs): MastraDBMessage[] => {
  const result = [...conversation];

  // ----- Template-literal passthrough chunk types from NetworkChunkType -----
  // `agent-execution-event-*` and `workflow-execution-event-*` carry nested
  // events that are surfaced through other mechanisms (e.g. tool-output
  // routing); at the top-level DB accumulator they are no-ops. The narrow is
  // expressed as a function so the remaining switch can be exhaustive over
  // the literal-typed variants.
  if (isTemplateLiteralPassthrough(chunk)) {
    return result;
  }

  // ----- Custom `data-*` chunks (including signal-echo) -----
  if (isDataChunk(chunk)) {
    if (
      chunk.type === 'data-user-message' &&
      'data' in chunk &&
      ((chunk as any).data?.type === 'user-message' || (chunk as any).data?.type === 'user')
    ) {
      const signalId = (chunk as any).data.id;

      // Preferred reconciliation: the optimistic pending bubble and the outgoing
      // message both carry a client-generated `clientMessageId`; the server
      // echoes it back here. Match on it (not the server-assigned signal id) so
      // the single optimistic bubble adopts the server id and clears its
      // transient pending state instead of being duplicated.
      const echoedClientMessageId = (chunk as any).data?.metadata?.[CLIENT_MESSAGE_ID_KEY];
      if (
        typeof echoedClientMessageId === 'string' &&
        result.some(
          message =>
            message.content.metadata?.status === 'pending' &&
            message.content.metadata[CLIENT_MESSAGE_ID_KEY] === echoedClientMessageId,
        )
      ) {
        return finishStreamingAssistantMessage(
          result.map(message =>
            message.content.metadata?.status === 'pending' &&
            message.content.metadata[CLIENT_MESSAGE_ID_KEY] === echoedClientMessageId
              ? reconcilePendingUserEcho(message, (chunk as any).data.contents, metadata, {
                  signalId: typeof signalId === 'string' ? signalId : undefined,
                  keepClientMessageId: true,
                })
              : message,
          ),
        );
      }

      if (typeof signalId === 'string' && result.some(message => message.id === signalId)) {
        return finishStreamingAssistantMessage(
          result.map(message =>
            message.id === signalId && message.content.metadata?.status === 'pending'
              ? reconcilePendingUserEcho(message, (chunk as any).data.contents, metadata, {
                  keepClientMessageId: false,
                })
              : message,
          ),
        );
      }

      const userMessages = signalContentsToUserMessages((chunk as any).data.contents, metadata);
      if (!userMessages.length) return result;

      const conversationWithFinishedAssistant = finishStreamingAssistantMessage(result);
      const messageIdPrefix = typeof signalId === 'string' ? signalId : `signal-${chunk.runId}-${Date.now()}`;
      return [
        ...conversationWithFinishedAssistant,
        ...userMessages.map((message, index) => ({
          ...message,
          id: index === 0 ? messageIdPrefix : `${messageIdPrefix}-${index}`,
        })),
      ];
    }

    const dataPart = {
      type: chunk.type as `data-${string}`,
      data: 'data' in chunk ? (chunk as any).data : undefined,
      ...('id' in chunk && typeof (chunk as any).id === 'string' ? { id: (chunk as any).id } : {}),
    } as unknown as MastraMessagePart;

    const lastMessage = result[result.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') {
      return appendAssistantMessage(result, `data-${chunk.runId}-${Date.now()}`, [dataPart], metadata);
    }

    return replaceLast(result, withParts(lastMessage, [...lastMessage.content.parts, dataPart]));
  }

  switch (chunk.type) {
    case 'tripwire': {
      const newMessage = newAssistantMessage(
        `tripwire-${chunk.runId + Date.now()}`,
        [{ type: 'text', text: chunk.payload.reason } as MastraMessagePart],
        {
          ...metadata,
          status: 'tripwire',
          tripwire: {
            reason: chunk.payload.reason,
            retry: chunk.payload.retry,
            metadata: chunk.payload.metadata,
            processorId: chunk.payload.processorId,
          },
        },
      );
      return [...result, newMessage];
    }

    case 'start': {
      const messageId = typeof chunk.payload.messageId === 'string' ? chunk.payload.messageId : undefined;
      if (messageId && result.some(message => message.id === messageId)) return result;
      return [...result, newAssistantMessage(messageId ?? `start-${chunk.runId + Date.now()}`, [], metadata)];
    }

    case 'text-start': {
      const lastMessage = result[result.length - 1];
      const textId = chunk.payload.id || `text-${Date.now()}`;
      if (
        chunk.payload.id &&
        lastMessage?.role === 'assistant' &&
        lastMessage.content.parts.some(part => part.type === 'text' && partTextId(part) === textId)
      ) {
        return result;
      }

      const newTextPart: MastraTextPart = {
        type: 'text',
        text: '',
        state: 'streaming',
        textId,
        providerMetadata: chunk.payload.providerMetadata,
      };

      if (!lastMessage || lastMessage.role !== 'assistant') {
        return appendAssistantMessage(
          result,
          `start-${chunk.runId}-${Date.now()}`,
          [newTextPart as MastraMessagePart],
          metadata,
        );
      }

      // If the last message is a completion/isTaskComplete result message, start a new assistant message
      if (lastMessage.content.metadata?.completionResult) {
        return appendAssistantMessage(
          result,
          `start-${chunk.runId}-${Date.now()}`,
          [newTextPart as MastraMessagePart],
          metadata,
        );
      }

      return replaceLast(
        result,
        withParts(lastMessage, [...lastMessage.content.parts, newTextPart as MastraMessagePart]),
      );
    }

    case 'background-task-progress': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      return replaceLast(
        result,
        withMetadata(lastMessage, {
          mode: metadata.mode,
          ...(lastMessage.content.metadata as MastraDBMessageMetadata | undefined),
          runningBackgroundTasksCount: chunk.payload.runningCount,
        }),
      );
    }

    case 'text-delta': {
      const lastMessage = result[result.length - 1];
      const textId = chunk.payload.id;

      if (!lastMessage || lastMessage.role !== 'assistant') {
        const newTextPart: MastraTextPart = {
          type: 'text',
          text: chunk.payload.text,
          state: 'streaming',
          textId,
          providerMetadata: chunk.payload.providerMetadata,
        };
        return appendAssistantMessage(
          result,
          `text-${chunk.runId}-${Date.now()}`,
          [newTextPart as MastraMessagePart],
          metadata,
        );
      }

      const parts = [...lastMessage.content.parts];

      let textPartIndex = textId
        ? parts.findLastIndex(part => part.type === 'text' && partTextId(part) === textId)
        : -1;

      if (textPartIndex === -1) {
        textPartIndex = parts.findLastIndex(part => part.type === 'text' && partState(part) === 'streaming');
      }

      if (textPartIndex === -1) {
        const newTextPart: MastraTextPart = {
          type: 'text',
          text: chunk.payload.text,
          state: 'streaming',
          textId,
          providerMetadata: chunk.payload.providerMetadata,
        };
        parts.push(newTextPart as MastraMessagePart);
      } else {
        const textPart = parts[textPartIndex] as MastraTextPart;
        parts[textPartIndex] = {
          ...textPart,
          text: textPart.text + chunk.payload.text,
          state: 'streaming',
        } as MastraMessagePart;
      }

      return replaceLast(result, withParts(lastMessage, parts));
    }

    case 'text-end': {
      // Lifecycle marker only. Streaming text parts stay in `state: 'streaming'`
      // and are finalized by `finish` / `abort` via `finishStreamingAssistantMessage`.
      // Returned as-is so the chunk-to-DB mapping stays total.
      return result;
    }

    case 'reasoning-start': {
      const lastMessage = result[result.length - 1];
      const newReasoningPart: MastraReasoningPart = {
        type: 'reasoning',
        reasoning: '',
        state: 'streaming',
        providerMetadata: chunk.payload.providerMetadata,
      };

      if (!lastMessage || lastMessage.role !== 'assistant') {
        return appendAssistantMessage(
          result,
          `reasoning-${chunk.runId + Date.now()}`,
          [newReasoningPart as unknown as MastraMessagePart],
          metadata,
        );
      }

      return replaceLast(
        result,
        withParts(lastMessage, [...lastMessage.content.parts, newReasoningPart as unknown as MastraMessagePart]),
      );
    }

    case 'reasoning-delta': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') {
        const newReasoningPart: MastraReasoningPart = {
          type: 'reasoning',
          reasoning: chunk.payload.text,
          state: 'streaming',
          providerMetadata: chunk.payload.providerMetadata,
        };
        return appendAssistantMessage(
          result,
          `reasoning-${chunk.runId + Date.now()}`,
          [newReasoningPart as unknown as MastraMessagePart],
          metadata,
        );
      }

      const parts = [...lastMessage.content.parts];
      const lastIndex = parts.length - 1;
      const lastPart = parts[lastIndex];

      if (lastPart?.type === 'reasoning') {
        const reasoningPart = lastPart as unknown as MastraReasoningPart;
        parts[lastIndex] = {
          ...reasoningPart,
          reasoning: reasoningPart.reasoning + chunk.payload.text,
          state: 'streaming',
        } as unknown as MastraMessagePart;
      } else {
        const newReasoningPart: MastraReasoningPart = {
          type: 'reasoning',
          reasoning: chunk.payload.text,
          state: 'streaming',
          providerMetadata: chunk.payload.providerMetadata,
        };
        parts.push(newReasoningPart as unknown as MastraMessagePart);
      }

      return replaceLast(result, withParts(lastMessage, parts));
    }

    case 'reasoning-end': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      const parts = [...lastMessage.content.parts];
      const reasoningIndex = parts.findLastIndex(part => part.type === 'reasoning' && partState(part) === 'streaming');
      if (reasoningIndex === -1) return result;

      const reasoningPart = parts[reasoningIndex] as unknown as MastraReasoningPart;
      const existingMeta = reasoningPart.providerMetadata;
      const endMeta = chunk.payload.providerMetadata;

      parts[reasoningIndex] = {
        ...reasoningPart,
        state: 'done',
        ...(existingMeta || endMeta ? { providerMetadata: { ...(existingMeta ?? {}), ...(endMeta ?? {}) } } : {}),
      } as unknown as MastraMessagePart;

      return replaceLast(result, withParts(lastMessage, parts));
    }

    case 'reasoning-signature': {
      // Merge the signature provider metadata into the most recent reasoning part
      // (streaming or done). Mirrors historical AI-SDK behavior where the
      // signature payload becomes part of the reasoning part's providerMetadata.
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      const parts = [...lastMessage.content.parts];
      const reasoningIndex = parts.findLastIndex(part => part.type === 'reasoning');
      if (reasoningIndex === -1) return result;

      const reasoningPart = parts[reasoningIndex] as unknown as MastraReasoningPart;
      const existingMeta = reasoningPart.providerMetadata;
      const sigMeta = chunk.payload.providerMetadata;

      parts[reasoningIndex] = {
        ...reasoningPart,
        ...(existingMeta || sigMeta ? { providerMetadata: { ...(existingMeta ?? {}), ...(sigMeta ?? {}) } } : {}),
      } as unknown as MastraMessagePart;

      return replaceLast(result, withParts(lastMessage, parts));
    }

    case 'redacted-reasoning': {
      // Emit a done reasoning part flagged as redacted. The provider redacted
      // the content; the placeholder preserves the slot in the parts array.
      const lastMessage = result[result.length - 1];
      const redactedData = chunk.payload.data;
      const redactedPart: MastraReasoningPart = {
        type: 'reasoning',
        reasoning: typeof redactedData === 'string' ? redactedData : '',
        state: 'done',
        redacted: true,
        providerMetadata: chunk.payload.providerMetadata,
      };

      if (!lastMessage || lastMessage.role !== 'assistant') {
        return appendAssistantMessage(
          result,
          `redacted-reasoning-${chunk.runId + Date.now()}`,
          [redactedPart as unknown as MastraMessagePart],
          metadata,
        );
      }

      return replaceLast(
        result,
        withParts(lastMessage, [...lastMessage.content.parts, redactedPart as unknown as MastraMessagePart]),
      );
    }

    case 'tool-call': {
      const invocation: MastraToolInvocation = {
        state: 'call',
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        args: chunk.payload.args,
      };
      const newPart: MastraToolInvocationPart = {
        ...makeToolInvocationPart(invocation),
        providerMetadata: chunk.payload.providerMetadata,
      };

      // Upsert by toolCallId: if `tool-call-input-streaming-start` already created
      // a placeholder part for this id, transition it in place instead of
      // appending a duplicate. `chunk.payload.args` is the authoritative
      // server-side parsed args and overwrites any client-side JSON.parse done
      // during streaming.
      const existing = locateToolPart(result, chunk.payload.toolCallId, false);
      if (existing && existing.toolPartIndex >= 0) {
        const { messageIndex, toolPartIndex } = existing;
        const targetMessage = result[messageIndex];
        if (targetMessage && targetMessage.role === 'assistant') {
          const parts = [...targetMessage.content.parts];
          const prev = parts[toolPartIndex] as MastraToolInvocationPart & { argsText?: string };
          if (isToolPart(prev)) {
            const { argsText: _argsText, ...rest } = prev;
            parts[toolPartIndex] = {
              ...rest,
              toolInvocation: {
                ...prev.toolInvocation,
                state: 'call',
                toolName: chunk.payload.toolName,
                toolCallId: chunk.payload.toolCallId,
                args: chunk.payload.args,
              } as MastraToolInvocation,
              providerMetadata: chunk.payload.providerMetadata ?? prev.providerMetadata,
            } as MastraMessagePart;
            return replaceAt(result, messageIndex, withParts(targetMessage, parts));
          }
        }
      }

      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') {
        return appendAssistantMessage(result, `tool-call-${chunk.runId + Date.now()}`, [newPart], metadata);
      }

      return replaceLast(result, withParts(lastMessage, [...lastMessage.content.parts, newPart]));
    }

    case 'tool-call-input-streaming-start': {
      // Create a placeholder tool-invocation part in `partial-call` state with an
      // empty args buffer; subsequent `tool-call-delta` chunks append JSON
      // fragments to `argsText` and `tool-call-input-streaming-end` parses them.
      const lastMessage = result[result.length - 1];
      const invocation: MastraToolInvocation = {
        state: 'partial-call',
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        args: {},
      };
      const newPart: MastraToolInvocationPart & { argsText?: string } = {
        ...makeToolInvocationPart(invocation),
        argsText: '',
      };

      if (!lastMessage || lastMessage.role !== 'assistant') {
        return appendAssistantMessage(
          result,
          `tool-call-streaming-${chunk.runId + Date.now()}`,
          [newPart as MastraMessagePart],
          metadata,
        );
      }

      return replaceLast(result, withParts(lastMessage, [...lastMessage.content.parts, newPart as MastraMessagePart]));
    }

    case 'tool-call-delta': {
      // Append the streamed JSON fragment onto the matching tool invocation's
      // `argsText` buffer. Keep `args` empty/parsed-so-far until the end chunk.
      const location = locateToolPart(result, chunk.payload.toolCallId, false);
      if (!location || location.toolPartIndex < 0) return result;
      const { messageIndex, toolPartIndex } = location;
      const targetMessage = result[messageIndex];
      if (!targetMessage || targetMessage.role !== 'assistant') return result;

      const parts = [...targetMessage.content.parts];
      const toolPart = parts[toolPartIndex] as MastraToolInvocationPart & { argsText?: string };
      if (!isToolPart(toolPart)) return result;

      const nextArgsText = (toolPart.argsText ?? '') + (chunk.payload.argsTextDelta ?? '');
      parts[toolPartIndex] = {
        ...toolPart,
        argsText: nextArgsText,
        toolInvocation: {
          ...toolPart.toolInvocation,
          state: 'partial-call',
        } as MastraToolInvocation,
      } as MastraMessagePart;

      return replaceAt(result, messageIndex, withParts(targetMessage, parts));
    }

    case 'tool-call-input-streaming-end': {
      // Finalize the streaming args: parse `argsText` and transition to `call`.
      // If parsing fails, keep `args: {}` so downstream consumers stay safe.
      const location = locateToolPart(result, chunk.payload.toolCallId, false);
      if (!location || location.toolPartIndex < 0) return result;
      const { messageIndex, toolPartIndex } = location;
      const targetMessage = result[messageIndex];
      if (!targetMessage || targetMessage.role !== 'assistant') return result;

      const parts = [...targetMessage.content.parts];
      const toolPart = parts[toolPartIndex] as MastraToolInvocationPart & { argsText?: string };
      if (!isToolPart(toolPart)) return result;

      let parsedArgs: Record<string, unknown> = {};
      const argsText = toolPart.argsText;
      if (typeof argsText === 'string' && argsText.length > 0) {
        try {
          const maybe = JSON.parse(argsText);
          if (maybe && typeof maybe === 'object' && !Array.isArray(maybe)) {
            parsedArgs = maybe as Record<string, unknown>;
          }
        } catch {
          parsedArgs = {};
        }
      }

      parts[toolPartIndex] = {
        ...toolPart,
        toolInvocation: {
          ...toolPart.toolInvocation,
          state: 'call',
          args: parsedArgs,
        } as MastraToolInvocation,
      } as MastraMessagePart;

      return replaceAt(result, messageIndex, withParts(targetMessage, parts));
    }

    case 'tool-error':
    case 'tool-result':
    case 'background-task-completed':
    case 'background-task-failed': {
      const isBgTaskEvent = chunk.type === 'background-task-completed' || chunk.type === 'background-task-failed';
      const location = locateToolPart(result, chunk.payload.toolCallId, isBgTaskEvent);
      if (!location) return result;
      const { messageIndex, toolPartIndex } = location;
      const targetMessage = result[messageIndex];
      if (!targetMessage || targetMessage.role !== 'assistant') return result;

      const parts = [...targetMessage.content.parts];
      const toolPart = toolPartIndex >= 0 ? parts[toolPartIndex] : undefined;

      // Narrow the merged-case payload by chunk.type so each branch has typed
      // access to its specific fields without `as any`.
      let payloadResult: unknown;
      let payloadError: unknown;
      let payloadIsError = false;
      let payloadProviderMetadata: MastraProviderMetadata | undefined;
      let payloadCompletedAt: Date | undefined;
      let payloadTaskId: string | undefined;
      switch (chunk.type) {
        case 'tool-result':
          payloadResult = chunk.payload.result;
          payloadIsError = Boolean(chunk.payload.isError);
          payloadProviderMetadata = chunk.payload.providerMetadata as MastraProviderMetadata | undefined;
          break;
        case 'tool-error':
          payloadError = chunk.payload.error;
          payloadProviderMetadata = chunk.payload.providerMetadata as MastraProviderMetadata | undefined;
          break;
        case 'background-task-completed':
          payloadResult = chunk.payload.result;
          payloadCompletedAt = chunk.payload.completedAt;
          payloadTaskId = chunk.payload.taskId;
          break;
        case 'background-task-failed':
          payloadError = chunk.payload.error;
          payloadCompletedAt = chunk.payload.completedAt;
          payloadTaskId = chunk.payload.taskId;
          break;
      }

      if (toolPart && isToolPart(toolPart)) {
        const { toolName, toolCallId, args } = toolPart.toolInvocation;
        // Provider metadata flows through opaquely; cast once at the storage
        // boundary because the V4 part type pins it to SharedV2ProviderMetadata
        // (Record<string, Record<string, JSONValue>>) and Mastra payloads are
        // not constrained to that shape.
        const providerMeta = (payloadProviderMetadata ??
          toolPart.providerMetadata) as MastraToolInvocationPart['providerMetadata'];

        const isError = chunk.type === 'tool-error' || chunk.type === 'background-task-failed' || payloadIsError;

        if (isError) {
          const error =
            chunk.type === 'tool-error' || chunk.type === 'background-task-failed' ? payloadError : payloadResult;
          const errorText =
            typeof error === 'string'
              ? error
              : error instanceof Error
                ? error.message
                : ((error as { message?: string } | null)?.message ?? String(error));

          parts[toolPartIndex] = {
            ...toolPart,
            providerMetadata: providerMeta,
            toolInvocation: {
              state: 'output-error',
              toolCallId,
              toolName,
              args,
              errorText,
            } as MastraToolInvocation,
          };
        } else {
          const resultObj = payloadResult as { result?: { steps?: unknown }; childMessages?: unknown } | undefined;
          // A workflow tool-result is a *finalization* event, not a replacement.
          // The accumulated `WorkflowStreamResult` (steps, status, etc.) was
          // built up by prior `tool-output` chunks via
          // `mapWorkflowStreamChunkToWatchResult`. The terminal `tool-result`
          // payload for dynamic workflows is often just `{ result: <scalar>, runId }`
          // with no `steps` field, so detecting workflows purely from the new
          // payload would clobber that state. Also check the tool name and any
          // previously-accumulated `WorkflowStreamResult`-shaped result.
          const existingResult =
            toolPart.toolInvocation.state === 'partial-call' || toolPart.toolInvocation.state === 'result'
              ? (toolPart.toolInvocation as { result?: unknown }).result
              : undefined;
          const existingLooksLikeWorkflow = Boolean(
            existingResult && typeof existingResult === 'object' && 'steps' in (existingResult as object),
          );
          const isWorkflow =
            Boolean(resultObj?.result?.steps) || toolName?.startsWith('workflow-') || existingLooksLikeWorkflow;
          const isAgent = chunk.from === 'AGENT';
          let output: unknown;
          if (isWorkflow) {
            // Prefer merging the terminal payload into the accumulated
            // workflow state so the UI keeps its step history.
            const accumulated =
              existingLooksLikeWorkflow && existingResult && typeof existingResult === 'object'
                ? (existingResult as Record<string, unknown>)
                : undefined;
            const payloadWorkflow =
              resultObj?.result && typeof resultObj.result === 'object'
                ? (resultObj.result as Record<string, unknown>)
                : undefined;
            if (accumulated || payloadWorkflow) {
              output = {
                ...(accumulated ?? {}),
                ...(payloadWorkflow ?? {}),
                // Preserve `steps` from accumulated state when the terminal
                // payload doesn't carry them.
                steps: (payloadWorkflow?.steps as unknown) ?? (accumulated?.steps as unknown) ?? [],
                status: (payloadWorkflow?.status as unknown) ?? (accumulated?.status as unknown) ?? 'success',
                // Surface the terminal scalar output without losing history.
                output: payloadResult,
              };
            } else {
              output = payloadResult;
            }
          } else if (isAgent) {
            const existingOutput =
              toolPart.toolInvocation.state === 'result' ? toolPart.toolInvocation.result : undefined;
            const existingChild = (existingOutput as { childMessages?: unknown[] } | undefined)?.childMessages;
            output = existingOutput
              ? {
                  ...(payloadResult as object),
                  childMessages: existingChild?.length ? existingChild : resultObj?.childMessages,
                }
              : payloadResult;
          } else {
            output = payloadResult;
          }

          parts[toolPartIndex] = {
            ...toolPart,
            providerMetadata: providerMeta,
            toolInvocation: {
              state: 'result',
              toolCallId,
              toolName,
              args,
              result: output,
            } as MastraToolInvocation,
          };
        }
      }

      const nextMetadata = mergeBgTaskMetadata(
        targetMessage.content.metadata as MastraDBMessageMetadata | undefined,
        metadata.mode,
        {
          resetRunningCount: isBgTaskEvent,
          perTaskEntry:
            isBgTaskEvent && payloadTaskId
              ? {
                  toolCallId: chunk.payload.toolCallId,
                  completedAt: payloadCompletedAt,
                  taskId: payloadTaskId,
                }
              : undefined,
        },
      );

      const nextMessage: MastraDBMessage = {
        ...targetMessage,
        content: {
          ...targetMessage.content,
          parts,
          metadata: nextMetadata,
        },
      };

      return replaceAt(result, messageIndex, nextMessage);
    }

    case 'background-task-running': {
      const location = locateToolPart(result, chunk.payload.toolCallId, true);
      if (!location) return result;
      const { messageIndex } = location;
      const targetMessage = result[messageIndex];
      if (!targetMessage || targetMessage.role !== 'assistant') return result;

      const nextMetadata = mergeBgTaskMetadata(
        targetMessage.content.metadata as MastraDBMessageMetadata | undefined,
        metadata.mode,
        {
          perTaskEntry: {
            toolCallId: chunk.payload.toolCallId,
            startedAt: chunk.payload.startedAt,
            taskId: chunk.payload.taskId,
          },
        },
      );

      return replaceAt(result, messageIndex, withMetadata(targetMessage, nextMetadata));
    }

    case 'tool-output':
    case 'background-task-output': {
      const isBgTaskOutput = chunk.type === 'background-task-output';
      const location = locateToolPart(result, chunk.payload.toolCallId, isBgTaskOutput);
      if (!location || location.toolPartIndex < 0) return result;
      const { messageIndex, toolPartIndex } = location;
      const targetMessage = result[messageIndex];
      if (!targetMessage || targetMessage.role !== 'assistant') return result;

      const parts = [...targetMessage.content.parts];
      const toolPart = parts[toolPartIndex];
      if (!isToolPart(toolPart)) return result;

      const { toolName, toolCallId, args } = toolPart.toolInvocation;
      const payloadOutput =
        chunk.type === 'background-task-output' ? chunk.payload.payload.payload.output : chunk.payload.output;

      // Workflow stream output: accumulate into watch-result state
      if (payloadOutput?.type?.startsWith('workflow-')) {
        const existingWorkflowState =
          ((toolPart.toolInvocation as any).result as WorkflowStreamResult<any, any, any, any>) ||
          ({} as WorkflowStreamResult<any, any, any, any>);
        const updated = mapWorkflowStreamChunkToWatchResult(existingWorkflowState, payloadOutput);

        parts[toolPartIndex] = {
          ...toolPart,
          toolInvocation: {
            state: 'partial-call',
            toolCallId,
            toolName,
            args,
            result: updated,
          } as MastraToolInvocation,
        };
      } else if (
        payloadOutput?.from === 'AGENT' ||
        (payloadOutput?.from === 'USER' && payloadOutput?.payload?.output?.type?.startsWith('workflow-'))
      ) {
        return accumulateAgentChunk(payloadOutput, result, metadata, toolCallId, toolName);
      } else {
        const currentResult = (toolPart.toolInvocation as any).result;
        const existing = Array.isArray(currentResult) ? currentResult : [];
        parts[toolPartIndex] = {
          ...toolPart,
          toolInvocation: {
            state: 'partial-call',
            toolCallId,
            toolName,
            args,
            result: [...existing, payloadOutput],
          } as MastraToolInvocation,
        };
      }

      return replaceAt(result, messageIndex, withParts(targetMessage, parts));
    }

    case 'is-task-complete': {
      if (chunk.payload.suppressFeedback) return result;

      const feedback = formatStreamCompletionFeedback(
        {
          complete: chunk.payload.passed,
          scorers: chunk.payload.results,
          totalDuration: chunk.payload.duration,
          timedOut: chunk.payload.timedOut,
          completionReason: chunk.payload.reason,
        },
        chunk.payload.maxIterationReached,
      );

      const newMessage = newAssistantMessage(
        `is-task-complete-${chunk.runId + Date.now()}`,
        [{ type: 'text', text: feedback } as MastraMessagePart],
        {
          ...metadata,
          completionResult: { passed: chunk.payload.passed },
        },
      );
      return [...result, newMessage];
    }

    case 'source': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      const parts = [...lastMessage.content.parts];
      if (chunk.payload.sourceType === 'url') {
        // Flat V5 `source-url` shape (see boundary cast policy above). Typed as
        // the shared `AIV5Type.SourceUrlUIPart` so the literal is shape-checked,
        // then stored via the storage-boundary cast like the other V5 parts.
        const sourceUrlPart: AIV5Type.SourceUrlUIPart = {
          type: 'source-url',
          sourceId: chunk.payload.id,
          url: chunk.payload.url || '',
          title: chunk.payload.title,
          providerMetadata: chunk.payload.providerMetadata,
        };
        parts.push(sourceUrlPart as unknown as MastraMessagePart);
      } else if (chunk.payload.sourceType === 'document') {
        parts.push({
          type: 'source-document',
          sourceId: chunk.payload.id,
          mediaType: chunk.payload.mimeType || 'application/octet-stream',
          title: chunk.payload.title,
          filename: chunk.payload.filename,
          providerMetadata: chunk.payload.providerMetadata,
        } as MastraMessagePart);
      }

      return replaceLast(result, withParts(lastMessage, parts));
    }

    case 'file': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      const parts = [...lastMessage.content.parts];

      let data: string;
      if (typeof chunk.payload.data === 'string') {
        data = chunk.payload.base64
          ? `data:${chunk.payload.mimeType};base64,${chunk.payload.data}`
          : `data:${chunk.payload.mimeType},${encodeURIComponent(chunk.payload.data)}`;
      } else {
        const base64 = uint8ArrayToBase64(chunk.payload.data);
        data = `data:${chunk.payload.mimeType};base64,${base64}`;
      }

      parts.push({
        type: 'file',
        mimeType: chunk.payload.mimeType,
        data,
        providerMetadata: chunk.payload.providerMetadata,
      } as unknown as MastraMessagePart);

      return replaceLast(result, withParts(lastMessage, parts));
    }

    case 'tool-call-approval': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      const existingMeta = (lastMessage.content.metadata as MastraDBMessageMetadata | undefined) ?? {};
      const lastRequireApproval = existingMeta.mode === 'stream' ? (existingMeta.requireApprovalMetadata ?? {}) : {};

      return replaceLast(result, {
        ...lastMessage,
        content: {
          ...lastMessage.content,
          metadata: {
            ...existingMeta,
            mode: 'stream',
            requireApprovalMetadata: {
              ...lastRequireApproval,
              [chunk.payload.toolName]: {
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args as Record<string, unknown>,
              },
            },
          },
        },
      });
    }

    case 'tool-call-suspended':
    case 'background-task-suspended': {
      const isBgTaskEvent = chunk.type === 'background-task-suspended';
      // Narrow merged payloads explicitly. Both shapes carry the fields below.
      let suspToolCallId: string;
      let suspToolName: string;
      let suspArgs: Record<string, unknown>;
      let suspPayload: unknown;
      let suspSuspendedAt: Date | undefined;
      let suspTaskId: string | undefined;
      if (chunk.type === 'background-task-suspended') {
        suspToolCallId = chunk.payload.toolCallId;
        suspToolName = chunk.payload.toolName;
        suspArgs = chunk.payload.args;
        suspPayload = chunk.payload.suspendPayload;
        suspSuspendedAt = chunk.payload.suspendedAt;
        suspTaskId = chunk.payload.taskId;
      } else {
        suspToolCallId = chunk.payload.toolCallId;
        suspToolName = chunk.payload.toolName;
        suspArgs = chunk.payload.args as Record<string, unknown>;
        suspPayload = chunk.payload.suspendPayload;
      }

      const location = isBgTaskEvent
        ? locateToolPart(result, suspToolCallId, true)
        : { messageIndex: result.length - 1 };
      if (!location) return result;
      const { messageIndex } = location;
      const targetMessage = result[messageIndex];
      if (!targetMessage || targetMessage.role !== 'assistant') return result;

      const existingMeta = (targetMessage.content.metadata as MastraDBMessageMetadata | undefined) ?? {};
      const lastSuspendedTools = existingMeta.mode === 'stream' ? (existingMeta.suspendedTools ?? {}) : {};

      const nextMetadata = mergeBgTaskMetadata(
        existingMeta,
        'stream',
        {
          resetRunningCount: isBgTaskEvent,
          perTaskEntry:
            isBgTaskEvent && suspTaskId
              ? {
                  toolCallId: suspToolCallId,
                  suspendedAt: suspSuspendedAt,
                  taskId: suspTaskId,
                }
              : undefined,
        },
        {
          suspendedTools: {
            ...lastSuspendedTools,
            [suspToolName]: {
              toolCallId: suspToolCallId,
              toolName: suspToolName,
              args: suspArgs,
              suspendPayload: suspPayload,
              runId: chunk.runId,
            },
          },
        },
      );

      return replaceAt(result, messageIndex, withMetadata(targetMessage, nextMetadata));
    }

    case 'finish':
    case 'abort': {
      return finishStreamingAssistantMessage(result);
    }

    case 'error': {
      const newMessage = newAssistantMessage(
        `error-${chunk.runId + Date.now()}`,
        [
          {
            type: 'text',
            text: typeof chunk.payload.error === 'string' ? chunk.payload.error : JSON.stringify(chunk.payload.error),
          } as MastraMessagePart,
        ],
        {
          ...metadata,
          status: 'error',
        },
      );
      return [...result, newMessage];
    }

    // ----- Lifecycle / step / framing chunks (not surfaced on DB messages) -----
    case 'step-start':
    case 'step-finish':
    case 'step-output':
    case 'raw':
    case 'watch':
    case 'response-metadata':
      return result;

    // ----- Goal evaluation signal (feedback is already injected into the
    // message history by the core goal step; the chunk is a consumer-only
    // signal and is not surfaced as its own DB message). -----
    case 'goal':
      return result;

    // ----- Object chunks (object/object-result are not stored on DB messages) -----
    case 'object':
    case 'object-result':
      return result;

    // ----- Background-task lifecycle markers not folded into messages -----
    case 'background-task-started':
    case 'background-task-cancelled':
    case 'background-task-resumed':
      return result;

    // ----- Workflow lifecycle passthroughs (handled by mapWorkflowStreamChunkToWatchResult inside tool-output) -----
    case 'workflow-start':
    case 'workflow-finish':
    case 'workflow-canceled':
    case 'workflow-paused':
    case 'workflow-step-start':
    case 'workflow-step-finish':
    case 'workflow-step-suspended':
    case 'workflow-step-waiting':
    case 'workflow-step-output':
    case 'workflow-step-progress':
    case 'workflow-step-result':
      return result;

    // ----- Nested-execution / routing / network passthroughs -----
    case 'agent-execution-start':
    case 'agent-execution-approval':
    case 'agent-execution-suspended':
    case 'agent-execution-end':
    case 'agent-execution-abort':
    case 'tool-execution-start':
    case 'tool-execution-end':
    case 'tool-execution-approval':
    case 'tool-execution-suspended':
    case 'tool-execution-abort':
    case 'routing-agent-start':
    case 'routing-agent-text-delta':
    case 'routing-agent-text-start':
    case 'routing-agent-end':
    case 'routing-agent-abort':
    case 'workflow-execution-start':
    case 'workflow-execution-end':
    case 'workflow-execution-suspended':
    case 'workflow-execution-abort':
    case 'network-execution-event-step-finish':
    case 'network-execution-event-finish':
    case 'network-validation-start':
    case 'network-validation-end':
    case 'network-object':
    case 'network-object-result':
      return result;

    default:
      // Exhaustiveness check: any new `ChunkType` variant must be added above.
      return assertExhaustive(chunk, result);
  }
};

/**
 * Compile-time exhaustiveness helper. At runtime, returns the conversation
 * unchanged so unexpected chunk variants never throw inside the React stream
 * pump; TypeScript will fail to compile if `ChunkType` ever grows a new branch
 * that isn't enumerated above.
 */
const assertExhaustive = (_chunk: never, fallback: MastraDBMessage[]): MastraDBMessage[] => fallback;

// ----- Nested agent-chunk accumulation (mirrors `toUIMessageFromAgent`) -----

const accumulateAgentChunk = (
  chunk: AgentChunkType,
  conversation: MastraDBMessage[],
  _metadata: MastraDBMessageMetadata,
  parentToolCallId?: string,
  parentToolName?: string,
): MastraDBMessage[] => {
  const lastMessage = conversation[conversation.length - 1];
  if (!lastMessage || lastMessage.role !== 'assistant') return conversation;

  const parts = [...lastMessage.content.parts];

  const findToolPartIndex = () =>
    parts.findIndex(
      part =>
        isToolPart(part) &&
        ((parentToolCallId && part.toolInvocation.toolCallId === parentToolCallId) ||
          (parentToolName && part.toolInvocation.toolName === parentToolName)),
    );

  if (chunk.type === 'text-delta') {
    const agentChunk = chunk.payload as any;
    const toolPartIndex = findToolPartIndex();
    if (toolPartIndex === -1) return conversation;

    const toolPart = parts[toolPartIndex] as MastraToolInvocationPart;
    const existingResult = (toolPart.toolInvocation as any).result || {};
    const childMessages = existingResult.childMessages || [];
    const lastChildMessage = childMessages[childMessages.length - 1];

    const textMessage = { type: 'text', content: (lastChildMessage?.content || '') + agentChunk.text };
    const nextChildren =
      lastChildMessage?.type === 'text'
        ? [...childMessages.slice(0, -1), textMessage]
        : [...childMessages, textMessage];

    parts[toolPartIndex] = {
      ...toolPart,
      toolInvocation: {
        ...toolPart.toolInvocation,
        result: { ...existingResult, childMessages: nextChildren },
      } as MastraToolInvocation,
    };
  } else if (chunk.type === 'tool-call') {
    const agentChunk = chunk.payload as any;
    const toolPartIndex = findToolPartIndex();
    if (toolPartIndex === -1) return conversation;

    const toolPart = parts[toolPartIndex] as MastraToolInvocationPart;
    const existingResult = (toolPart.toolInvocation as any).result || {};
    const childMessages = existingResult.childMessages || [];

    parts[toolPartIndex] = {
      ...toolPart,
      toolInvocation: {
        ...toolPart.toolInvocation,
        result: {
          ...existingResult,
          childMessages: [
            ...childMessages,
            {
              type: 'tool',
              toolCallId: agentChunk.toolCallId,
              toolName: agentChunk.toolName,
              args: agentChunk.args,
            },
          ],
        },
      } as MastraToolInvocation,
    };
  } else if (chunk.type === 'tool-output') {
    const agentChunk = chunk.payload as any;
    const toolPartIndex = findToolPartIndex();
    if (toolPartIndex === -1) return conversation;

    const toolPart = parts[toolPartIndex] as MastraToolInvocationPart;
    if (agentChunk?.output?.type?.startsWith('workflow-')) {
      const existingResult = (toolPart.toolInvocation as any).result || {};
      const childMessages = existingResult.childMessages || [];
      const lastIndex = childMessages.length - 1;
      const currentMessage = childMessages[lastIndex];
      const actualExistingWorkflowState = (currentMessage as any)?.toolOutput || {};
      const updated = mapWorkflowStreamChunkToWatchResult(actualExistingWorkflowState, agentChunk.output);

      if (lastIndex >= 0 && childMessages[lastIndex]?.type === 'tool') {
        parts[toolPartIndex] = {
          ...toolPart,
          toolInvocation: {
            ...toolPart.toolInvocation,
            result: {
              ...existingResult,
              childMessages: [
                ...childMessages.slice(0, -1),
                {
                  ...currentMessage,
                  toolOutput: { ...updated, runId: agentChunk.output.runId },
                },
              ],
            },
          } as MastraToolInvocation,
        };
      }
    }
  } else if (chunk.type === 'tool-result') {
    const agentChunk = chunk.payload as any;
    const toolPartIndex = findToolPartIndex();
    if (toolPartIndex === -1) return conversation;

    const toolPart = parts[toolPartIndex] as MastraToolInvocationPart;
    const existingResult = (toolPart.toolInvocation as any).result || {};
    const childMessages = existingResult.childMessages || [];
    const lastIndex = childMessages.length - 1;
    const isWorkflow = agentChunk?.toolName?.startsWith('workflow-');

    if (lastIndex >= 0 && childMessages[lastIndex]?.type === 'tool') {
      parts[toolPartIndex] = {
        ...toolPart,
        toolInvocation: {
          ...toolPart.toolInvocation,
          result: {
            ...existingResult,
            childMessages: [
              ...childMessages.slice(0, -1),
              {
                ...childMessages[lastIndex],
                toolOutput: isWorkflow
                  ? { ...(agentChunk.result as any)?.result, runId: (agentChunk.result as any)?.runId }
                  : agentChunk.result,
              },
            ],
          },
        } as MastraToolInvocation,
      };
    }
  }

  return replaceLast(conversation, withParts(lastMessage, parts));
};

export interface AccumulateNetworkChunkArgs {
  chunk: NetworkChunkType;
  conversation: MastraDBMessage[];
  metadata: MastraDBMessageMetadata;
}

// Network-mode helpers
// --------------------
// These mirror the historical `AISdkNetworkTransformer` from the AI-SDK layer,
// translating `NetworkChunkType` into `MastraDBMessage[]`. The transformer's
// `MastraUIMessage` model (`{ parts, metadata }`) maps onto `MastraDBMessage`
// (`content.parts` / `content.metadata`). Text and `dynamic-tool` parts are
// stored as the same V5-flavored superset of `MastraMessagePart` documented in
// the boundary-cast policy at the top of this file. This is a temporary bridge
// to keep network mode rendering until the next major.

const networkMode = (metadata: MastraDBMessageMetadata): MastraDBMessageMetadata => ({ ...metadata, mode: 'network' });

const findPartIndex = (parts: MastraMessagePart[], predicate: (part: MastraMessagePart) => boolean): number =>
  parts.findIndex(predicate);

// `dynamic-tool` is a V5 part type stored via the boundary-cast policy; it is
// not present in the V4 `MastraMessagePart` union, so match on the raw string.
const isDynamicToolPart = (part: MastraMessagePart): boolean => (part as { type: string }).type === 'dynamic-tool';

const lastAssistant = (conversation: MastraDBMessage[]): MastraDBMessage | undefined => {
  const last = conversation[conversation.length - 1];
  return last && last.role === 'assistant' ? last : undefined;
};

/**
 * Try to parse the buffered routing-agent text as a JSON object. Returns the
 * parsed object on success, or `null` while the buffer is still incomplete or
 * not JSON at all.
 */
const tryParseRoutingDecision = (buffered: string): Record<string, unknown> | null => {
  const trimmed = buffered.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Routing-agent text deltas describe the network's routing decision (often a
 * JSON object such as `{ "isNetwork": true, "agentId": "...", ... }`). The raw
 * payload is never useful in the rendered thread, so we buffer it in
 * message-level metadata, promote it to `routingDecision` when it parses as
 * JSON, and fall back to `routingDecisionText` for non-JSON routing models.
 * No visible text part is produced.
 */
const handleRoutingAgentDelta = (
  chunk: NetworkChunkType,
  conversation: MastraDBMessage[],
  metadata: MastraDBMessageMetadata,
): MastraDBMessage[] => {
  const delta = (chunk.payload as { text?: string })?.text ?? '';
  if (!delta) return conversation;

  const lastMessage = lastAssistant(conversation);

  const mergeRoutingMetadata = (existing: MastraDBMessageMetadata): MastraDBMessageMetadata => {
    const buffered = (existing.routingDecisionBuffer ?? '') + delta;
    const next: MastraDBMessageMetadata = { ...cloneMetadata(existing), mode: 'network' };
    const parsed = tryParseRoutingDecision(buffered);
    if (parsed) {
      next.routingDecision = parsed;
      delete next.routingDecisionBuffer;
      delete next.routingDecisionText;
    } else {
      next.routingDecisionBuffer = buffered;
      next.routingDecisionText = buffered;
    }
    return next;
  };

  if (!lastMessage) {
    const seed = mergeRoutingMetadata({});
    return appendAssistantMessage(
      conversation,
      `routing-agent-${(chunk.payload as { runId?: string })?.runId ?? 'unknown'}-${Date.now()}`,
      [],
      { ...networkMode(metadata), ...seed },
    );
  }

  return replaceLast(conversation, withMetadata(lastMessage, mergeRoutingMetadata(lastMessage.content.metadata ?? {})));
};

const handleAgentNetworkChunk = (
  chunk: NetworkChunkType,
  conversation: MastraDBMessage[],
  metadata: MastraDBMessageMetadata,
): MastraDBMessage[] => {
  if (chunk.type === 'agent-execution-start') {
    const primitiveId = (chunk.payload as any)?.args?.primitiveId;
    const runId = (chunk.payload as any).runId;
    if (!primitiveId || !runId) return conversation;

    const toolPart = {
      type: 'dynamic-tool',
      toolName: primitiveId,
      toolCallId: runId,
      state: 'input-available',
      input: (chunk.payload as any).args,
    } as unknown as MastraMessagePart;

    return appendAssistantMessage(conversation, `agent-execution-start-${runId}-${Date.now()}`, [toolPart], {
      ...networkMode(metadata),
      selectionReason: (chunk.payload as any)?.args?.selectionReason || '',
      agentInput: (chunk.payload as any)?.args?.task,
      from: 'AGENT',
    });
  }

  if (chunk.type === 'agent-execution-end') {
    const lastMessage = lastAssistant(conversation);
    if (!lastMessage) return conversation;

    const parts = [...lastMessage.content.parts];
    const toolPartIndex = findPartIndex(parts, part => isDynamicToolPart(part));
    if (toolPartIndex !== -1) {
      const toolPart = parts[toolPartIndex] as any;
      const currentOutput = toolPart.output as any;
      parts[toolPartIndex] = {
        type: 'dynamic-tool',
        toolName: toolPart.toolName,
        toolCallId: toolPart.toolCallId,
        state: 'output-available',
        input: toolPart.input,
        output: { ...currentOutput, result: currentOutput?.result || (chunk.payload as any)?.result || '' },
      } as unknown as MastraMessagePart;
    }

    return replaceLast(conversation, withParts(lastMessage, parts));
  }

  if (chunk.type.startsWith('agent-execution-event-')) {
    const lastMessage = lastAssistant(conversation);
    if (!lastMessage) return conversation;

    const agentChunk = chunk.payload as any;
    const parts = [...lastMessage.content.parts];
    const toolPartIndex = findPartIndex(parts, part => isDynamicToolPart(part));
    if (toolPartIndex === -1) return conversation;
    const toolPart = parts[toolPartIndex] as any;

    if (agentChunk.type === 'text-delta') {
      const childMessages = toolPart?.output?.childMessages || [];
      const lastChildMessage = childMessages[childMessages.length - 1];
      const textMessage = { type: 'text', content: (lastChildMessage?.content || '') + agentChunk.payload.text };
      const nextMessages =
        lastChildMessage?.type === 'text'
          ? [...childMessages.slice(0, -1), textMessage]
          : [...childMessages, textMessage];
      parts[toolPartIndex] = {
        ...toolPart,
        output: { childMessages: nextMessages },
      } as unknown as MastraMessagePart;
    } else if (agentChunk.type === 'tool-call') {
      const childMessages = toolPart?.output?.childMessages || [];
      parts[toolPartIndex] = {
        ...toolPart,
        output: {
          ...toolPart?.output,
          childMessages: [
            ...childMessages,
            {
              type: 'tool',
              toolCallId: agentChunk.payload.toolCallId,
              toolName: agentChunk.payload.toolName,
              args: agentChunk.payload.args,
            },
          ],
        },
      } as unknown as MastraMessagePart;
    } else if (agentChunk.type === 'tool-output') {
      if (agentChunk.payload?.output?.type?.startsWith('workflow-')) {
        const childMessages = toolPart?.output?.childMessages || [];
        const lastToolIndex = childMessages.length - 1;
        const currentMessage = childMessages[lastToolIndex];
        const actualExistingWorkflowState = currentMessage?.toolOutput || {};
        const updatedWorkflowState = mapWorkflowStreamChunkToWatchResult(
          actualExistingWorkflowState,
          agentChunk.payload.output,
        );
        if (lastToolIndex >= 0 && childMessages[lastToolIndex]?.type === 'tool') {
          parts[toolPartIndex] = {
            ...toolPart,
            output: {
              ...toolPart?.output,
              childMessages: [...childMessages.slice(0, -1), { ...currentMessage, toolOutput: updatedWorkflowState }],
            },
          } as unknown as MastraMessagePart;
        }
      }
    } else if (agentChunk.type === 'tool-result') {
      const childMessages = toolPart?.output?.childMessages || [];
      const lastToolIndex = childMessages.length - 1;
      const isWorkflow = Boolean(agentChunk.payload?.result?.result?.steps);
      if (lastToolIndex >= 0 && childMessages[lastToolIndex]?.type === 'tool') {
        parts[toolPartIndex] = {
          ...toolPart,
          output: {
            ...toolPart?.output,
            childMessages: [
              ...childMessages.slice(0, -1),
              {
                ...childMessages[lastToolIndex],
                toolOutput: isWorkflow ? agentChunk.payload.result.result : agentChunk.payload.result,
              },
            ],
          },
        } as unknown as MastraMessagePart;
      }
    }

    return replaceLast(conversation, withParts(lastMessage, parts));
  }

  return conversation;
};

const handleWorkflowNetworkChunk = (
  chunk: NetworkChunkType,
  conversation: MastraDBMessage[],
  metadata: MastraDBMessageMetadata,
): MastraDBMessage[] => {
  if (chunk.type === 'workflow-execution-start') {
    const primitiveId = (chunk.payload as any)?.args?.primitiveId;
    const runId = (chunk.payload as any).runId;
    if (!primitiveId || !runId) return conversation;

    let agentInput: string | object;
    try {
      agentInput = JSON.parse((chunk.payload as any)?.args?.prompt);
    } catch {
      agentInput = (chunk.payload as any)?.args?.prompt;
    }

    const toolPart = {
      type: 'dynamic-tool',
      toolName: primitiveId,
      toolCallId: runId,
      state: 'input-available',
      input: (chunk.payload as any).args,
    } as unknown as MastraMessagePart;

    return appendAssistantMessage(conversation, `workflow-start-${runId}-${Date.now()}`, [toolPart], {
      ...networkMode(metadata),
      selectionReason: (chunk.payload as any)?.args?.selectionReason || '',
      from: 'WORKFLOW',
      agentInput,
    });
  }

  if (chunk.type === 'workflow-execution-suspended') {
    const lastMessage = lastAssistant(conversation);
    if (!lastMessage) return conversation;
    const existing = lastMessage.content.metadata?.suspendedTools ?? {};
    return replaceLast(
      conversation,
      withMetadata(lastMessage, {
        ...cloneMetadata(lastMessage.content.metadata),
        mode: 'network',
        suspendedTools: {
          ...existing,
          [(chunk.payload as any).toolName]: {
            toolCallId: (chunk.payload as any).toolCallId,
            toolName: (chunk.payload as any).toolName,
            args: (chunk.payload as any).args,
            suspendPayload: (chunk.payload as any).suspendPayload,
            runId: (chunk.payload as any).runId,
          },
        },
      }),
    );
  }

  if (chunk.type.startsWith('workflow-execution-event-')) {
    const lastMessage = lastAssistant(conversation);
    if (!lastMessage) return conversation;

    const parts = [...lastMessage.content.parts];
    const toolPartIndex = findPartIndex(parts, part => isDynamicToolPart(part));
    if (toolPartIndex === -1) return conversation;
    const toolPart = parts[toolPartIndex] as any;

    const existingWorkflowState = (toolPart.output as WorkflowStreamResult<any, any, any, any>) || ({} as any);
    const updatedWorkflowState = mapWorkflowStreamChunkToWatchResult(existingWorkflowState, chunk.payload as any);

    parts[toolPartIndex] = { ...toolPart, output: updatedWorkflowState } as unknown as MastraMessagePart;
    return replaceLast(conversation, withParts(lastMessage, parts));
  }

  return conversation;
};

const handleToolNetworkChunk = (
  chunk: NetworkChunkType,
  conversation: MastraDBMessage[],
  metadata: MastraDBMessageMetadata,
): MastraDBMessage[] => {
  if (chunk.type === 'tool-execution-start') {
    const argsData = (chunk.payload as any).args;
    const nestedArgs = argsData.args || {};
    const lastMessage = lastAssistant(conversation);

    const toolPart = {
      type: 'dynamic-tool',
      toolName: argsData.toolName || 'unknown',
      toolCallId: argsData.toolCallId || 'unknown',
      state: 'input-available',
      input: nestedArgs,
    } as unknown as MastraMessagePart;

    if (!lastMessage) {
      return appendAssistantMessage(
        conversation,
        `tool-start-${(chunk.payload as any).runId}-${Date.now()}`,
        [toolPart],
        {
          ...networkMode(metadata),
          selectionReason: metadata.mode === 'network' ? metadata.selectionReason || argsData.selectionReason : '',
          agentInput: nestedArgs,
        },
      );
    }

    const parts = [...lastMessage.content.parts, toolPart];
    return replaceLast(conversation, withParts(lastMessage, parts));
  }

  if (chunk.type === 'tool-execution-approval') {
    const lastMessage = lastAssistant(conversation);
    if (!lastMessage) return conversation;
    const existing = lastMessage.content.metadata?.requireApprovalMetadata ?? {};
    return replaceLast(
      conversation,
      withMetadata(lastMessage, {
        ...cloneMetadata(lastMessage.content.metadata),
        mode: 'network',
        requireApprovalMetadata: {
          ...existing,
          [(chunk.payload as any).toolName]: {
            toolCallId: (chunk.payload as any).toolCallId,
            toolName: (chunk.payload as any).toolName,
            args: (chunk.payload as any).args,
            runId: (chunk.payload as any).runId,
          },
        },
      }),
    );
  }

  if (chunk.type === 'tool-execution-suspended') {
    const lastMessage = lastAssistant(conversation);
    if (!lastMessage) return conversation;
    const existing = lastMessage.content.metadata?.suspendedTools ?? {};
    return replaceLast(
      conversation,
      withMetadata(lastMessage, {
        ...cloneMetadata(lastMessage.content.metadata),
        mode: 'network',
        suspendedTools: {
          ...existing,
          [(chunk.payload as any).toolName]: {
            toolCallId: (chunk.payload as any).toolCallId,
            toolName: (chunk.payload as any).toolName,
            args: (chunk.payload as any).args,
            suspendPayload: (chunk.payload as any).suspendPayload,
            runId: (chunk.payload as any).runId,
          },
        },
      }),
    );
  }

  if (chunk.type === 'tool-execution-end') {
    const lastMessage = lastAssistant(conversation);
    if (!lastMessage) return conversation;

    const parts = [...lastMessage.content.parts];
    const toolPartIndex = findPartIndex(
      parts,
      part => isDynamicToolPart(part) && (part as any).toolCallId === (chunk.payload as any).toolCallId,
    );
    if (toolPartIndex !== -1) {
      const toolPart = parts[toolPartIndex] as any;
      const currentOutput = toolPart.output as any;
      parts[toolPartIndex] = {
        type: 'dynamic-tool',
        toolName: toolPart.toolName,
        toolCallId: toolPart.toolCallId,
        state: 'output-available',
        input: toolPart.input,
        output: currentOutput?.result || (chunk.payload as any)?.result || '',
      } as unknown as MastraMessagePart;
    }

    return replaceLast(conversation, withParts(lastMessage, parts));
  }

  return conversation;
};

/**
 * Reduce a single network-mode chunk into the running `MastraDBMessage[]`
 * conversation. Ports the historical `AISdkNetworkTransformer` so the playground
 * keeps rendering network badges (routing text, agent/workflow/tool execution,
 * suspensions, approvals, completion feedback) until the next major.
 */
export const accumulateNetworkChunk = ({
  chunk,
  conversation,
  metadata,
}: AccumulateNetworkChunkArgs): MastraDBMessage[] => {
  const newConversation = [...conversation];

  if (chunk.type === 'routing-agent-text-delta') {
    return handleRoutingAgentDelta(chunk, newConversation, metadata);
  }

  if (chunk.type.startsWith('agent-execution-')) {
    return handleAgentNetworkChunk(chunk, newConversation, metadata);
  }

  if (chunk.type.startsWith('workflow-execution-')) {
    return handleWorkflowNetworkChunk(chunk, newConversation, metadata);
  }

  if (chunk.type.startsWith('tool-execution-')) {
    return handleToolNetworkChunk(chunk, newConversation, metadata);
  }

  if (chunk.type === 'network-validation-end') {
    if ((chunk.payload as any).suppressFeedback) return newConversation;

    const feedback = formatCompletionFeedback(
      {
        complete: (chunk.payload as any).passed,
        scorers: (chunk.payload as any).results,
        totalDuration: (chunk.payload as any).duration,
        timedOut: (chunk.payload as any).timedOut,
        completionReason: (chunk.payload as any).reason,
      },
      (chunk.payload as any).maxIterationReached,
    );

    const textPart = { type: 'text', text: feedback } as unknown as MastraMessagePart;
    return appendAssistantMessage(
      newConversation,
      `network-validation-end-${(chunk.payload as any).runId}-${Date.now()}`,
      [textPart],
      {
        ...networkMode(metadata),
        completionResult: { passed: (chunk.payload as any).passed },
      },
    );
  }

  if (chunk.type === 'network-execution-event-step-finish') {
    const lastMessage = lastAssistant(newConversation);
    if (!lastMessage) return newConversation;

    const agentChunk = chunk.payload as any;
    const parts = [...lastMessage.content.parts];
    const textPartIndex = findPartIndex(parts, part => part.type === 'text');

    if (textPartIndex === -1) {
      parts.push({ type: 'text', text: agentChunk.result, state: 'done' } as unknown as MastraMessagePart);
      return replaceLast(newConversation, withParts(lastMessage, parts));
    }

    const textPart = parts[textPartIndex];
    if (textPart.type === 'text') {
      parts[textPartIndex] = {
        ...(textPart as MastraTextPart),
        state: 'done',
      } as unknown as MastraMessagePart;
      return replaceLast(newConversation, withParts(lastMessage, parts));
    }

    return newConversation;
  }

  return newConversation;
};

// Re-export the provider-metadata helper for inspection in tests.
export { partProviderMetadata as __partProviderMetadata };
