import { stripAnsi } from '@mastra/playground-ui/components/ai/tool-call';
import type { ToolCallStatus } from '@mastra/playground-ui/components/ai/tool-call';
import type { AgentControllerEvent, AgentControllerTaskSnapshot } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';
import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';

import { sentByOther } from './message-author';

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  argsText: string;
  args?: unknown;
  status: 'running' | 'done' | 'error';
  result?: unknown;
  output: string;
  // Epoch milliseconds.
  createdAt?: number;
}

export function toolCallStatus(status: ToolCall['status']): ToolCallStatus {
  return status === 'done' ? 'idle' : status;
}

export interface MessageEntry {
  kind: 'message';
  id: string;
  message: MastraDBMessage;
  runtimeTools?: Record<string, ToolCall>;
  streaming?: boolean;
  steer?: boolean;
  deliveryStatus?: 'pending' | 'delivered' | 'failed';
}

export interface NoticeEntry {
  kind: 'notice';
  id: string;
  level: 'info' | 'error';
  text: string;
}

export interface ApprovalPrompt {
  kind: 'approval';
  id: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
}

export interface SuspensionPrompt {
  kind: 'suspension';
  id: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
  suspendPayload: unknown;
}

export interface NotificationEntry {
  kind: 'notification';
  id: string;
  notificationId?: string;
  message: string;
  source?: string;
  notifKind?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationSummaryEntry {
  kind: 'notification_summary';
  id: string;
  message: string;
  pending: number;
  bySource: Record<string, number>;
  byPriority: Record<string, number>;
  notificationIds: string[];
}

export interface SubagentEntry {
  kind: 'subagent';
  id: string;
  toolCallId: string;
  agentType: string;
  task: string;
  modelId: string;
  done: boolean;
}

export type PromptEntry = ApprovalPrompt | SuspensionPrompt;
export type TimelineEntry =
  | MessageEntry
  | NoticeEntry
  | PromptEntry
  | NotificationEntry
  | NotificationSummaryEntry
  | SubagentEntry;

export interface TranscriptState {
  entries: TimelineEntry[];
  pending: boolean;
  threadId?: string;
  tasks: AgentControllerTaskSnapshot[];
}

export const initialTranscript: TranscriptState = {
  entries: [],
  pending: false,
  tasks: [],
};

let noticeSeq = 0;
export function createLocalMessageId(): string {
  return `local-${Date.now()}-${noticeSeq++}`;
}

export interface OutgoingFile {
  data: string;
  mediaType: string;
  filename?: string;
}

type Action =
  | { type: 'event'; event: AgentControllerEvent; viewerId?: string }
  | { type: 'localUser'; id?: string; text: string; steer?: boolean; files?: OutgoingFile[] }
  | { type: 'failLocalUser'; id: string }
  | { type: 'clearPending' }
  | { type: 'localNotice'; text: string; level: 'info' | 'error' }
  | { type: 'resolvePrompt'; id: string }
  | { type: 'mergeWindow'; messages: MastraDBMessage[] }
  | { type: 'reset'; threadId?: string };

function toOutgoingFilePart(file: OutgoingFile): MastraMessagePart {
  if (file.mediaType.startsWith('image/')) {
    return { type: 'file', data: file.data, mimeType: file.mediaType };
  }
  return {
    type: 'file',
    data: file.data,
    mimeType: file.mediaType,
    ...(file.filename ? { filename: file.filename } : {}),
  };
}

export function transcriptReducer(state: TranscriptState, action: Action): TranscriptState {
  switch (action.type) {
    case 'reset':
      return {
        ...initialTranscript,
        threadId: action.threadId,
      };
    case 'localUser':
      return {
        ...state,
        pending: true,
        entries: [
          ...state.entries,
          toMessageEntry(
            {
              id: action.id ?? createLocalMessageId(),
              role: 'user',
              createdAt: new Date(),
              content: {
                format: 2,
                parts: [{ type: 'text', text: action.text }, ...(action.files ?? []).map(toOutgoingFilePart)],
              },
            },
            { steer: action.steer, deliveryStatus: action.steer ? 'pending' : undefined },
          ),
        ],
      };
    case 'mergeWindow':
      return mergeServerWindow(state, action.messages);
    case 'clearPending':
      return { ...state, pending: false };
    case 'failLocalUser':
      return {
        ...state,
        entries: state.entries.map(entry =>
          entry.kind === 'message' && entry.id === action.id && entry.deliveryStatus === 'pending'
            ? { ...entry, deliveryStatus: 'failed' }
            : entry,
        ),
      };
    case 'localNotice':
      return pushNotice(state, action.level, action.text);
    case 'resolvePrompt':
      return { ...state, entries: state.entries.filter(e => !('id' in e) || e.id !== action.id) };
    case 'event':
      return applyEvent(state, action.event, action.viewerId);
    default:
      return state;
  }
}

function applyEvent(state: TranscriptState, event: AgentControllerEvent, viewerId?: string): TranscriptState {
  if (!isKnownAgentControllerEvent(event)) return state;
  switch (event.type) {
    case 'agent_end':
      return { ...state, pending: false };

    case 'message_start':
    case 'message_update': {
      const message = event.message;
      const next = upsertMessage(state, message, true, viewerId);
      if (message.role !== 'assistant') return next;
      return hasAssistantText(next) ? { ...next, pending: false } : next;
    }
    case 'message_end': {
      const next = upsertMessage(state, event.message, false, viewerId);
      return event.message.role === 'assistant' ? { ...next, pending: false } : next;
    }

    case 'tool_input_start':
      return withTool(state, event.toolCallId, t => ({ ...t, toolName: event.toolName }), {
        toolName: event.toolName,
      });
    case 'tool_input_delta': {
      // Display processors may transform argsTextDelta to a non-string payload.
      if (typeof event.argsTextDelta !== 'string') return state;
      const argsTextDelta = event.argsTextDelta;
      return withTool(state, event.toolCallId, t => ({ ...t, argsText: t.argsText + argsTextDelta }));
    }
    case 'tool_start':
      return withTool(
        state,
        event.toolCallId,
        t => ({
          ...t,
          toolName: event.toolName,
          args: event.args,
          status: 'running',
          createdAt: t.createdAt ?? Date.now(),
        }),
        {
          toolName: event.toolName,
          args: event.args,
        },
      );
    case 'shell_output':
      return withTool(state, event.toolCallId, t => ({ ...t, output: t.output + stripAnsi(event.output) }));
    case 'tool_update':
      return withTool(state, event.toolCallId, t => ({ ...t, result: event.partialResult }));
    case 'tool_end':
      return withTool(state, event.toolCallId, t => ({
        ...t,
        status: event.isError ? 'error' : 'done',
        result: event.result,
      }));

    case 'tool_approval_required':
      return pushPrompt(state, {
        kind: 'approval',
        id: `approval-${event.toolCallId}`,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      });
    case 'tool_suspended':
      return pushPrompt(state, {
        kind: 'suspension',
        id: `suspension-${event.toolCallId}`,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        suspendPayload: event.suspendPayload,
      });

    case 'mode_changed':
    case 'model_changed':
      return state;
    case 'thread_changed':
      return { ...state, threadId: event.threadId };

    case 'task_updated':
      return { ...state, tasks: event.tasks };

    case 'notification':
      return {
        ...state,
        entries: [
          ...state.entries,
          {
            kind: 'notification' as const,
            id: `notif-${event.notificationId ?? Date.now()}-${noticeSeq++}`,
            notificationId: event.notificationId,
            message: event.message,
            source: event.source,
            notifKind: event.kind,
            priority: event.priority,
            metadata: event.metadata,
          },
        ],
      };
    case 'notification_summary':
      return {
        ...state,
        entries: [
          ...state.entries,
          {
            kind: 'notification_summary' as const,
            id: `notif-summary-${Date.now()}-${noticeSeq++}`,
            message: event.message,
            pending: event.pending,
            bySource: event.bySource,
            byPriority: event.byPriority,
            notificationIds: event.notificationIds,
          },
        ],
      };

    case 'subagent_start':
      return {
        ...state,
        entries: [
          ...state.entries,
          {
            kind: 'subagent' as const,
            id: `subagent-${event.toolCallId}`,
            toolCallId: event.toolCallId,
            agentType: event.agentType,
            task: event.task,
            modelId: event.modelId,
            done: false,
          },
        ],
      };
    case 'subagent_end': {
      const entries = state.entries.map(e =>
        e.kind === 'subagent' && e.toolCallId === event.toolCallId ? { ...e, done: true } : e,
      );
      return { ...state, entries };
    }

    // The sidebar handles thread lifecycle events.
    case 'thread_created':
    case 'thread_deleted':
      return state;

    case 'workspace_error':
      return pushNotice(state, 'error', `Workspace: ${event.error.message}`);
    case 'workspace_status_changed':
      if (event.status !== 'error' || !event.error) return state;
      return pushNotice(state, 'error', `Workspace: ${event.error.message}`);

    case 'info':
      return pushNotice(state, 'info', event.message);
    case 'error':
      return pushNotice(state, 'error', describeErrorEvent(event));

    default:
      return state;
  }
}

function describeErrorEvent(event: { error: { message?: string } | string; errorType?: string }): string {
  const message = typeof event.error === 'string' ? event.error : event.error?.message;
  if (message) return message;
  if (event.errorType) return `Run failed (${event.errorType}). Check the server logs for details.`;
  return 'Run failed with an unknown error. Check the server logs for details.';
}

export function createInitialTranscript({
  messages = [],
  threadId,
}: {
  messages?: MastraDBMessage[];
  threadId?: string;
} = {}): TranscriptState {
  return {
    ...initialTranscript,
    entries: messagesToEntries(messages),
    threadId,
  };
}

function messagesToEntries(messages: MastraDBMessage[]): TimelineEntry[] {
  return messages.flatMap(message => [
    toMessageEntry(message, { streaming: false }),
    ...persistedSuspensionPrompts(message),
  ]);
}

function persistedSuspensionPrompts(message: MastraDBMessage): SuspensionPrompt[] {
  const suspendedTools = message.content.metadata?.suspendedTools;
  if (!suspendedTools || typeof suspendedTools !== 'object' || Array.isArray(suspendedTools)) return [];

  return Object.values(suspendedTools).flatMap(suspension => {
    if (
      !suspension ||
      typeof suspension !== 'object' ||
      Array.isArray(suspension) ||
      !('toolCallId' in suspension) ||
      !('toolName' in suspension) ||
      typeof suspension.toolCallId !== 'string' ||
      typeof suspension.toolName !== 'string'
    ) {
      return [];
    }

    return [
      {
        kind: 'suspension' as const,
        id: `suspension-${suspension.toolCallId}`,
        toolCallId: suspension.toolCallId,
        toolName: suspension.toolName,
        args: 'args' in suspension ? suspension.args : undefined,
        suspendPayload: 'suspendPayload' in suspension ? suspension.suspendPayload : undefined,
      },
    ];
  });
}

function mergeServerWindow(state: TranscriptState, messages: MastraDBMessage[]): TranscriptState {
  if (messages.length === 0) return state;

  const onScreenIndex = claimOnScreenEntries(state.entries, messages);
  const confirmed = confirmPendingUserMessages(state, onScreenIndex);
  const reconciled = reconcileToolResults(adoptCoveringWindowCopies(confirmed, onScreenIndex), messages);

  if (messages.every(message => onScreenIndex.has(message))) return reconciled;

  const entries: TimelineEntry[] = [];
  let cursor = 0;
  let missing: MastraDBMessage[] = [];

  for (const message of messages) {
    const anchorIndex = onScreenIndex.get(message);
    if (anchorIndex === undefined) {
      missing.push(message);
      continue;
    }

    if (anchorIndex < cursor) continue;
    entries.push(...reconciled.entries.slice(cursor, anchorIndex), ...messagesToEntries(missing));
    missing = [];
    cursor = anchorIndex;
  }
  entries.push(...reconciled.entries.slice(cursor), ...messagesToEntries(missing));

  return { ...reconciled, entries };
}

// SSE uses one assistant message per run; storage uses one per step.
function claimOnScreenEntries(
  entries: TimelineEntry[],
  messages: MastraDBMessage[],
  eligible?: (entry: MessageEntry) => boolean,
): Map<MastraDBMessage, number> {
  const onScreen = entries.map(indexMessageEntry);
  const anchors = new Map<MastraDBMessage, number>();
  const claimedEntries = new Set<number>();
  const claimedTexts = new Set<string>();

  for (const message of messages) {
    const displayed = toMessageEntry(message).message;
    const toolCallIds = toolCallIdsOf(displayed.content.parts);
    const texts = drawableTexts(message);
    const textClaim = (index: number) => `${index} ${texts.join('\n')}`;

    for (const [index, candidate] of onScreen.entries()) {
      if (!candidate || (eligible && !eligible(candidate.entry))) continue;
      const sameMessage =
        candidate.entry.id === message.id ||
        candidate.entry.message.id === message.id ||
        toolCallIds.some(toolCallId => candidate.toolCallIds.has(toolCallId));
      const alreadyDrawn = redrawsEntry(candidate, displayed, texts, toolCallIds);

      const claimsIdentity = sameMessage && !claimedEntries.has(index);
      const claimsText = alreadyDrawn && !claimedTexts.has(textClaim(index));
      if (!claimsIdentity && !claimsText) continue;

      anchors.set(message, index);
      claimedEntries.add(index);
      if (texts.length > 0) claimedTexts.add(textClaim(index));
      break;
    }
  }

  return anchors;
}

function isUnconfirmedSteer(entry: MessageEntry): boolean {
  return entry.deliveryStatus === 'pending' || entry.deliveryStatus === 'failed';
}

function confirmPendingUserMessages(state: TranscriptState, anchors: Map<MastraDBMessage, number>): TranscriptState {
  const confirmed = new Map<number, MessageEntry>();
  for (const [message, index] of anchors) {
    const current = state.entries[index];
    if (current?.kind !== 'message' || !isUnconfirmedSteer(current)) continue;
    const canonical = toMessageEntry(preserveOptimisticUserContent(message, current.message), {
      streaming: current.streaming,
      runtimeTools: current.runtimeTools,
    });
    if (canonical.message.role === 'user') confirmed.set(index, { ...canonical, id: current.id });
  }
  if (confirmed.size === 0) return state;

  return {
    ...state,
    entries: state.entries.map((entry, index) => confirmed.get(index) ?? entry),
  };
}

function redrawsEntry(
  candidate: OnScreenMessage,
  displayed: MastraDBMessage,
  texts: string[],
  toolCallIds: string[],
): boolean {
  if (texts.length === 0 || candidate.entry.message.role !== displayed.role) return false;
  if (!texts.every(text => drawsText(candidate, text))) return false;
  return toolCallIds.length === 0 || windowCopyCovers(candidate.entry.message.content.parts, displayed.content.parts);
}

function drawsText(candidate: OnScreenMessage, text: string): boolean {
  if (candidate.texts.has(text)) return true;
  if (!candidate.entry.streaming) return false;
  return [...candidate.texts].some(drawn => drawn.startsWith(text) || text.startsWith(drawn));
}

interface OnScreenMessage {
  entry: MessageEntry;
  toolCallIds: Set<string>;
  texts: Set<string>;
}

function indexMessageEntry(entry: TimelineEntry): OnScreenMessage | undefined {
  if (entry.kind !== 'message') return undefined;
  return {
    entry,
    toolCallIds: new Set(toolCallIdsOf(entry.message.content.parts)),
    texts: new Set(drawableTexts(entry.message)),
  };
}

function drawableTexts(message: MastraDBMessage): string[] {
  const textParts = message.content.parts.flatMap(part =>
    part.type === 'text' && part.text.trim().length > 0 ? [part.text.trim()] : [],
  );
  if (textParts.length > 0 || message.role !== 'signal') return textParts;

  return message.content.parts.flatMap(part => {
    if (part.type !== 'data-user-message' || !('data' in part)) return [];
    const text = signalContentsToText(part.data).trim();
    return text ? [text] : [];
  });
}

function toolCallIdsOf(parts: MastraMessagePart[]): string[] {
  return parts.flatMap(part => {
    const toolCallId = toolCallIdForPart(part);
    return toolCallId === undefined ? [] : [toolCallId];
  });
}

type ToolInvocationMessagePart = Extract<MastraMessagePart, { type: 'tool-invocation' }>;

export function isTerminalInvocationState(state: ToolInvocationMessagePart['toolInvocation']['state']): boolean {
  return state === 'result' || state === 'output-error' || state === 'output-denied';
}

function adoptCoveringWindowCopies(state: TranscriptState, anchors: Map<MastraDBMessage, number>): TranscriptState {
  const copyByEntry = new Map<number, MastraDBMessage>();
  for (const [message, index] of anchors) {
    if (message.role === 'assistant') copyByEntry.set(index, message);
  }

  let changed = false;
  const entries = state.entries.map((entry, index) => {
    const copy = copyByEntry.get(index);
    if (!copy || entry.kind !== 'message' || entry.message.role !== 'assistant') return entry;
    const onScreenParts = entry.message.content.parts;
    const covers = windowCopyCovers(onScreenParts, copy.content.parts);
    const identical = covers && windowCopyCovers(copy.content.parts, onScreenParts);
    if (!covers || identical) return entry;
    changed = true;
    return {
      ...entry,
      message: { ...entry.message, content: { ...entry.message.content, parts: copy.content.parts } },
    };
  });

  return changed ? { ...state, entries } : state;
}

function windowCopyCovers(onScreen: MastraMessagePart[], persisted: MastraMessagePart[]): boolean {
  if (persisted.length < onScreen.length) return false;
  return onScreen.every((part, index) => {
    const counterpart = persisted[index];
    if (part.type === 'text' && counterpart.type === 'text') return counterpart.text.startsWith(part.text);
    if (part.type === 'tool-invocation' && counterpart.type === 'tool-invocation') {
      if (part.toolInvocation.toolCallId !== counterpart.toolInvocation.toolCallId) return false;
      return (
        !isTerminalInvocationState(part.toolInvocation.state) ||
        isTerminalInvocationState(counterpart.toolInvocation.state)
      );
    }
    return JSON.stringify(counterpart) === JSON.stringify(part);
  });
}

// SSE gaps can swallow tool_end; persisted results settle the row.
function reconcileToolResults(state: TranscriptState, messages: MastraDBMessage[]): TranscriptState {
  const serverTerminalParts = new Map<string, ToolInvocationMessagePart>();
  for (const message of messages) {
    for (const part of message.content.parts) {
      if (part.type !== 'tool-invocation') continue;
      if (!isTerminalInvocationState(part.toolInvocation.state)) continue;
      serverTerminalParts.set(part.toolInvocation.toolCallId, part);
    }
  }
  if (serverTerminalParts.size === 0) return state;

  let changed = false;
  const entries = state.entries.map(entry => {
    if (entry.kind !== 'message' || entry.message.role !== 'assistant') return entry;
    let entryChanged = false;
    const parts = entry.message.content.parts.map(part => {
      if (part.type !== 'tool-invocation' || isTerminalInvocationState(part.toolInvocation.state)) return part;
      const serverPart = serverTerminalParts.get(part.toolInvocation.toolCallId);
      if (!serverPart) return part;
      entryChanged = true;
      return serverPart;
    });
    if (!entryChanged) return entry;
    changed = true;
    return { ...entry, message: { ...entry.message, content: { ...entry.message.content, parts } } };
  });

  return changed ? { ...state, entries } : state;
}

// Live user signals carry text in data.contents; persisted signals use text parts.
function withRenderableSignalText(message: MastraDBMessage): MastraDBMessage {
  const parts = message.content.parts ?? [];
  const hasDrawableText = parts.some(part => part.type === 'text' && part.text.trim().length > 0);
  if (hasDrawableText) return message;

  const text = parts
    .map(part => (part.type === 'data-user-message' ? signalContentsToText((part as { data?: unknown }).data) : ''))
    .filter(Boolean)
    .join('\n');
  if (!text) return message;

  return { ...message, content: { ...message.content, parts: [{ type: 'text', text }] } };
}

// Signal contents may be text or an array from partsToSignalContents.
function signalContentsToText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const contents = (data as { contents?: unknown }).contents;
  if (typeof contents === 'string') return contents;
  if (!Array.isArray(contents)) return '';
  return contents
    .map(entry => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && typeof (entry as { text?: unknown }).text === 'string') {
        return (entry as { text: string }).text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function toMessageEntry(
  message: MastraDBMessage,
  options: {
    streaming?: boolean;
    steer?: boolean;
    deliveryStatus?: MessageEntry['deliveryStatus'];
    runtimeTools?: Record<string, ToolCall>;
    viewerId?: string;
  } = {},
): MessageEntry {
  const signalMetadata = message.role === 'signal' ? message.content.metadata?.signal : undefined;
  const signal =
    signalMetadata && typeof signalMetadata === 'object' && !Array.isArray(signalMetadata)
      ? (signalMetadata as Record<string, unknown>)
      : undefined;
  const isUserSignal = signal?.type === 'user' || signal?.type === 'user-message';
  const attributes =
    signal?.attributes && typeof signal.attributes === 'object' && !Array.isArray(signal.attributes)
      ? (signal.attributes as Record<string, unknown>)
      : undefined;
  const normalized =
    isUserSignal && sentByOther(message, options.viewerId) ? withRenderableSignalText(message) : message;
  const displayMessage = isUserSignal ? { ...normalized, role: 'user' as const } : normalized;
  const steer = options.steer ?? (isUserSignal ? attributes?.delivery === 'while-active' : undefined);

  return {
    kind: 'message',
    id: message.id,
    message: displayMessage,
    runtimeTools: options.runtimeTools,
    streaming: options.streaming,
    steer,
    deliveryStatus: options.deliveryStatus ?? (steer ? 'delivered' : undefined),
  };
}

function indexOfSameTurn(entries: TimelineEntry[], message: MastraDBMessage): number {
  const index = latestAssistantIndex(entries);
  const entry = entries[index];
  if (entry?.kind !== 'message') return -1;

  if (entry.message.id.startsWith('assistant-tools-')) return index;
  return entry.streaming && windowCopyCovers(entry.message.content.parts, message.content.parts) ? index : -1;
}

function upsertMessage(
  state: TranscriptState,
  message: MastraDBMessage,
  streaming: boolean,
  viewerId?: string,
): TranscriptState {
  if (message.role !== 'assistant' && message.role !== 'signal') return state;
  const entries = [...state.entries];
  let idx = entries.findIndex(
    entry => entry.kind === 'message' && (entry.id === message.id || entry.message.id === message.id),
  );
  if (message.role === 'assistant' && idx === -1) idx = indexOfSameTurn(entries, message);
  if (message.role === 'signal' && idx === -1 && !sentByOther(message, viewerId)) {
    idx = claimOnScreenEntries(entries, [message], isUnconfirmedSteer).get(message) ?? -1;
  }
  const prev = idx !== -1 ? entries[idx] : undefined;
  const prevEntry = prev?.kind === 'message' ? prev : undefined;
  const nextMessage =
    message.role === 'assistant'
      ? withoutToolPartsDrawnElsewhere(preserveRuntimeToolParts(message, prevEntry?.message), entries, idx)
      : preserveOptimisticUserContent(message, prevEntry?.message, viewerId);
  const canonicalEntry = toMessageEntry(nextMessage, { streaming, runtimeTools: prevEntry?.runtimeTools, viewerId });
  // Changing the entry id remounts open cards.
  const entry = prevEntry ? { ...canonicalEntry, id: prevEntry.id } : canonicalEntry;

  if (idx === -1) entries.push(entry);
  else entries[idx] = entry;
  const next = { ...state, entries };
  return message.role === 'assistant' ? reconcileToolResults(next, [message]) : next;
}

function withoutToolPartsDrawnElsewhere(
  message: MastraDBMessage,
  entries: TimelineEntry[],
  own: number,
): MastraDBMessage {
  const drawnElsewhere = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (index === own || entry.kind !== 'message' || entry.message.role !== 'assistant') continue;
    for (const part of entry.message.content.parts) {
      const toolCallId = toolCallIdForPart(part);
      if (toolCallId) drawnElsewhere.add(toolCallId);
    }
  }
  if (drawnElsewhere.size === 0) return message;

  const parts = message.content.parts.filter(part => {
    const toolCallId = toolCallIdForPart(part);
    return !toolCallId || !drawnElsewhere.has(toolCallId);
  });
  if (parts.length === message.content.parts.length) return message;

  return { ...message, content: { ...message.content, parts } };
}

function preserveOptimisticUserContent(
  message: MastraDBMessage,
  previous?: MastraDBMessage,
  viewerId?: string,
): MastraDBMessage {
  if (!previous || previous.role !== 'user' || message.role !== 'signal' || sentByOther(message, viewerId)) {
    return message;
  }
  const hasDrawablePart = message.content.parts.some(part => part.type === 'text' || part.type === 'file');
  const hasUserDataPart = message.content.parts.some(part => part.type === 'data-user-message');
  if (hasDrawablePart || !hasUserDataPart) return message;

  return {
    ...message,
    content: { ...message.content, parts: previous.content.parts },
  };
}

function preserveRuntimeToolParts(message: MastraDBMessage, previous?: MastraDBMessage): MastraDBMessage {
  if (!previous) return message;

  const parts = [...message.content.parts];
  const existingToolIds = new Set(parts.map(toolCallIdForPart).filter((id): id is string => Boolean(id)));

  for (const part of previous.content.parts) {
    const toolCallId = toolCallIdForPart(part);
    if (toolCallId && !existingToolIds.has(toolCallId)) {
      parts.push(part);
      existingToolIds.add(toolCallId);
    }
  }

  return { ...message, content: { ...message.content, parts } };
}

function hasAssistantText(state: TranscriptState): boolean {
  const idx = latestAssistantIndex(state.entries);
  if (idx === -1) return false;
  const entry = state.entries[idx];
  if (entry.kind !== 'message' || !Array.isArray(entry.message.content.parts)) return false;
  return entry.message.content.parts.some(
    (part: unknown) =>
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      part.type === 'text' &&
      'text' in part &&
      typeof part.text === 'string' &&
      part.text.trim().length > 0,
  );
}

function toolAnchorIndex(entries: TimelineEntry[], toolCallId: string): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.kind !== 'message') continue;
    if (entry.runtimeTools?.[toolCallId]) return i;
    if (entry.message.content.parts.some(part => toolCallIdForPart(part) === toolCallId)) return i;
  }
  return latestAssistantIndex(entries);
}

function latestAssistantIndex(entries: TimelineEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.kind === 'message' && entry.message.role === 'assistant') return i;
  }
  return -1;
}

function withTool(
  state: TranscriptState,
  toolCallId: string,
  update: (tool: ToolCall) => ToolCall,
  seed?: Partial<ToolCall>,
): TranscriptState {
  const entries = [...state.entries];
  let idx = toolAnchorIndex(entries, toolCallId);
  if (idx === -1) {
    const message: MastraDBMessage = {
      id: `assistant-tools-${Date.now()}`,
      role: 'assistant',
      createdAt: new Date(),
      content: { format: 2, parts: [] },
    };

    entries.push(toMessageEntry(message, { streaming: true }));
    idx = entries.length - 1;
  }

  const entry = entries[idx];
  if (entry.kind !== 'message') return state;

  const parts = [...entry.message.content.parts];
  const runtimeTools = { ...(entry.runtimeTools ?? {}) };
  const existing =
    runtimeTools[toolCallId] ?? toolCallFromPart(parts.find(part => toolCallIdForPart(part) === toolCallId));
  const tool = update(
    existing ?? {
      toolCallId,
      toolName: seed?.toolName ?? 'tool',
      argsText: '',
      args: seed?.args,
      status: 'running',
      output: '',
    },
  );
  runtimeTools[toolCallId] = tool;

  const partIndex = parts.findIndex(part => toolCallIdForPart(part) === toolCallId);
  if (partIndex === -1) parts.push(toolPart(tool));
  else parts[partIndex] = toolPart(tool);

  entries[idx] = {
    ...entry,
    runtimeTools,
    message: { ...entry.message, content: { ...entry.message.content, parts } },
  };
  return { ...state, entries };
}

function toolCallIdForPart(part: MastraMessagePart): string | undefined {
  if (part.type !== 'tool-invocation') return undefined;
  return part.toolInvocation.toolCallId;
}

function toolCallFromPart(part: MastraMessagePart | undefined): ToolCall | undefined {
  if (!part || part.type !== 'tool-invocation') return undefined;
  const invocation = part.toolInvocation;
  return {
    toolCallId: invocation.toolCallId,
    toolName: invocation.toolName,
    argsText: '',
    args: 'args' in invocation ? invocation.args : undefined,
    status: invocation.state === 'result' ? 'done' : 'running',
    result: 'result' in invocation ? invocation.result : undefined,
    output: '',
    createdAt: part.createdAt,
  };
}

function toolPart(tool: ToolCall): MastraMessagePart {
  if (tool.status === 'running') {
    return {
      type: 'tool-invocation',
      toolInvocation: {
        state: 'call',
        toolCallId: tool.toolCallId,
        toolName: tool.toolName,
        args: tool.args,
      },
    };
  }

  // Match the isError field on persisted result invocations.
  const toolInvocation: ToolInvocationMessagePart['toolInvocation'] & { isError?: boolean } = {
    state: 'result',
    toolCallId: tool.toolCallId,
    toolName: tool.toolName,
    args: tool.args,
    result: tool.result,
    ...(tool.status === 'error' ? { isError: true } : {}),
  };
  return { type: 'tool-invocation', toolInvocation };
}

function pushPrompt(state: TranscriptState, prompt: PromptEntry): TranscriptState {
  if (state.entries.some(e => 'id' in e && e.id === prompt.id)) return state;
  return { ...state, entries: [...state.entries, prompt] };
}

function pushNotice(state: TranscriptState, level: 'info' | 'error', text: string): TranscriptState {
  return {
    ...state,
    entries: [...state.entries, { kind: 'notice', id: `notice-${Date.now()}-${noticeSeq++}`, level, text }],
  };
}
