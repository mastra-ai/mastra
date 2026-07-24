import type {
  AgentControllerEvent,
  KnownAgentControllerEvent,
  AgentControllerTaskSnapshot,
  AgentControllerOMProgress,
} from '@mastra/client-js';
import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';

import { stripAnsi } from './ansi';

/**
 * Transcript model + reducer.
 *
 * Folds the controller event stream into an ordered list of timeline entries the
 * UI renders top-to-bottom — mirroring what MastraCode's TUI shows: user and
 * assistant messages, tool-execution cards, interactive prompts, and notices.
 */

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  /** Streamed args text (from tool_input_delta) before the call resolves. */
  argsText: string;
  args?: unknown;
  status: 'running' | 'done' | 'error';
  result?: unknown;
  /** Appended shell stdout/stderr for shell-style tools. */
  output: string;
}

/**
 * An ordered piece of an assistant turn. The controller streams an assistant
 * message whose `content[]` interleaves text, thinking, and tool_call parts in
 * execution order; we mirror that order here so the UI renders
 * text → tool → text → tool exactly as it happened (matching the TUI), rather
 * than collapsing all text into one blob and bucketing tools at the end.
 *
 * Tool segments hold only the tool id; the live tool state (args/output/
 * status/result, which arrives on separate tool_* events) lives in the entry's
 * `toolsById` map and is resolved at render time.
 */
export interface MessageEntry {
  kind: 'message';
  id: string;
  message: MastraDBMessage;
  /** Live tool state from tool_* events, overlaid by toolCallId without changing persisted message parts. */
  runtimeTools?: Record<string, ToolCall>;
  /** True while the model is still generating tokens for this message. */
  streaming?: boolean;
  /** A steer (interjection) vs a normal message. */
  steer?: boolean;
}

export interface NoticeEntry {
  kind: 'notice';
  id: string;
  level: 'info' | 'error';
  text: string;
}

/** A pending tool approval (`tool_approval_required`). */
export interface ApprovalPrompt {
  kind: 'approval';
  id: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
}

/** A suspended interactive tool (`tool_suspended`): ask_user / request_access / submit_plan. */
export interface SuspensionPrompt {
  kind: 'suspension';
  id: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
  suspendPayload: unknown;
}

/** A notification delivered to the session. */
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

/** A notification summary batching multiple pending notifications. */
export interface NotificationSummaryEntry {
  kind: 'notification_summary';
  id: string;
  message: string;
  pending: number;
  bySource: Record<string, number>;
  byPriority: Record<string, number>;
  notificationIds: string[];
}

/** A subagent delegation (subagent_start / subagent_end). */
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
  MessageEntry | NoticeEntry | PromptEntry | NotificationEntry | NotificationSummaryEntry | SubagentEntry;

/** Token usage snapshot from usage_update events. */
export interface UsageSnapshot {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  [key: string]: unknown;
}

/** OM (observational memory) status. */
export type OMPhase = 'idle' | 'observing' | 'reflecting' | 'buffering';

/** Goal evaluation snapshot from goal_evaluation events. */
export interface GoalSnapshot {
  objective: string;
  status: 'active' | 'paused' | 'done';
  iteration: number;
  maxRuns: number;
  passed: boolean;
  reason?: string;
}

export interface TranscriptState {
  entries: TimelineEntry[];
  /**
   * Whether a turn the user just initiated is awaiting its first response.
   * Set the instant the user sends/steers (synchronously, before any SSE
   * events), and cleared once the agent finishes or streams its first token.
   * This makes the "thinking" indicator and Stop button latch reliably even
   * when the run's start/end events arrive in a single batched flush.
   */
  pending: boolean;
  threadId?: string;
  /** Current task list from task_updated events. */
  tasks: AgentControllerTaskSnapshot[];
  /** Accumulated token usage. */
  usage?: UsageSnapshot;
  /** Number of queued follow-up messages. */
  followUpCount: number;
  /** OM progress for the status line (msg/mem budgets), from display_state_changed. */
  omProgress?: AgentControllerOMProgress;
  /** Observational memory phase. */
  omPhase: OMPhase;
  /** Whether the workspace is ready. */
  workspaceReady?: boolean;
  /** Latest goal evaluation. */
  goal?: GoalSnapshot;
  /** Current tokens/sec throughput (0 when idle). */
  tokensPerSec: number;
  /**
   * @internal Timestamp (ms) of the first streamed content delta of the current
   * step — i.e. when decoding actually began. Used to measure tokens/sec over
   * decode time only, excluding TTFT and tool-execution gaps between steps.
   * 0 means decoding has not started for the current step.
   */
  _decodeStartedAt: number;
}

export const initialTranscript: TranscriptState = {
  entries: [],
  pending: false,
  tasks: [],
  followUpCount: 0,
  omPhase: 'idle',
  tokensPerSec: 0,
  _decodeStartedAt: 0,
};

let noticeSeq = 0;

/** A file attached to an outgoing message (base64-encoded, mirrors the client-js `sendMessage` files option). */
export interface OutgoingFile {
  data: string;
  mediaType: string;
  filename?: string;
}

type Action =
  | { type: 'event'; event: AgentControllerEvent }
  | { type: 'localUser'; text: string; steer?: boolean; files?: OutgoingFile[] }
  | { type: 'clearPending' }
  | { type: 'localNotice'; text: string; level: 'info' | 'error' }
  | { type: 'resolvePrompt'; id: string }
  | { type: 'prependOlder'; messages: MastraDBMessage[] }
  | {
      type: 'reset';
      threadId?: string;
      omProgress?: AgentControllerOMProgress;
      usage?: UsageSnapshot;
    };

/**
 * Mirror the server's signal → content split (stream-content.ts): outgoing
 * attachments surface as `file` parts; images keep only data + mimeType while
 * other files carry their filename for download affordances.
 */
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
        omProgress: action.omProgress,
        usage: action.usage,
      };
    case 'localUser':
      return {
        ...state,
        pending: true,
        entries: [
          ...state.entries,
          toMessageEntry(
            {
              id: `local-${Date.now()}-${noticeSeq++}`,
              role: 'user',
              createdAt: new Date(),
              content: {
                format: 2,
                parts: [{ type: 'text', text: action.text }, ...(action.files ?? []).map(toOutgoingFilePart)],
              },
            },
            { steer: action.steer },
          ),
        ],
      };
    case 'prependOlder':
      return prependOlderMessages(state, action.messages);
    case 'clearPending':
      return { ...state, pending: false };
    case 'localNotice':
      return pushNotice(state, action.level, action.text);
    case 'resolvePrompt':
      return { ...state, entries: state.entries.filter(e => !('id' in e) || e.id !== action.id) };
    case 'event':
      return applyEvent(state, action.event);
    default:
      return state;
  }
}

function applyEvent(state: TranscriptState, raw: AgentControllerEvent): TranscriptState {
  const event = raw as KnownAgentControllerEvent;
  switch (event.type) {
    case 'agent_start':
      // Reset the rate at the start of a new turn (not at the end) so the last
      // turn's tokens/sec stays visible while idle — short single-step turns
      // would otherwise zero it before it could be read.
      return { ...state, tokensPerSec: 0, _decodeStartedAt: 0 };
    case 'agent_end':
      // Keep tokensPerSec as the last turn's reading; only clear the in-flight
      // decode window so a stale start can't bleed into the next turn.
      return { ...state, pending: false, _decodeStartedAt: 0 };

    case 'message_start':
    case 'message_update': {
      const message = event.message as MastraDBMessage;
      const next = upsertMessage(state, message, true);
      if (message.role !== 'assistant') return next;
      // Only streamed assistant content opens the decode window — empty or
      // tool-only updates must not count toward tokens/sec.
      if (!hasAssistantText(next)) {
        return next;
      }
      // Mark the start of decoding for the current step on the first streamed
      // content delta, so tokens/sec is measured over decode time only (it
      // excludes TTFT before this point and tool gaps between steps). usage_update
      // at step-finish closes this window and re-arms it for the next step.
      const decoded = next._decodeStartedAt > 0 ? next : { ...next, _decodeStartedAt: Date.now() };
      // First streamed assistant content clears the "thinking" pending state.
      return { ...decoded, pending: false };
    }
    case 'message_end': {
      const next = upsertMessage(state, event.message, false);
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
        t => ({ ...t, toolName: event.toolName, args: event.args, status: 'running' }),
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

    // Goals.
    case 'goal_evaluation':
      return {
        ...state,
        goal: {
          objective: event.payload.objective,
          status: event.payload.status,
          iteration: event.payload.iteration,
          maxRuns: event.payload.maxRuns,
          passed: event.payload.passed,
          reason: event.payload.reason,
        },
      };

    // Subagents.
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

    // Thread lifecycle events are surfaced by the sidebar (query invalidation)
    // and toasts, not as transcript notices — a worktree deletion can cascade
    // over many threads and would otherwise spam the open conversation.
    case 'thread_created':
    case 'thread_deleted':
      return state;

    // Usage tracking.
    case 'usage_update': {
      const usageSnap = event.usage as UsageSnapshot;
      const now = Date.now();
      // usage_update fires at step-finish and carries the completion (and any
      // reasoning) tokens generated during this step. Measure tokens/sec over the
      // decode window only — from the step's first content delta (_decodeStartedAt)
      // to now — which excludes TTFT and inter-step tool/scheduling time. Smooth
      // with an exponential moving average (α=0.3) for a stable readout.
      const stepTokens = (usageSnap.completionTokens ?? 0) + (usageSnap.reasoningTokens ?? 0);
      let tps = state.tokensPerSec;
      if (state._decodeStartedAt > 0 && stepTokens > 0) {
        const decodeSec = Math.max((now - state._decodeStartedAt) / 1000, 0.001);
        const instantaneous = stepTokens / decodeSec;
        const alpha = 0.3;
        tps =
          state.tokensPerSec > 0
            ? Math.round(alpha * instantaneous + (1 - alpha) * state.tokensPerSec)
            : Math.round(instantaneous);
      }
      return {
        ...state,
        usage: usageSnap,
        tokensPerSec: tps,
        // Re-arm: the next step's decode window opens on its first content delta.
        _decodeStartedAt: 0,
      };
    }

    // Canonical display-state snapshot — carries the status-line figures
    // (OM msg/mem budgets and cumulative token usage).
    case 'display_state_changed': {
      const ds = event.displayState;
      return {
        ...state,
        omProgress: ds.omProgress ?? state.omProgress,
        usage: (ds.tokenUsage as UsageSnapshot | undefined) ?? state.usage,
      };
    }

    // Follow-up queue.
    case 'follow_up_queued':
      return { ...state, followUpCount: event.count };

    // Observational memory lifecycle.
    case 'om_observation_start':
      return { ...state, omPhase: 'observing' };
    case 'om_observation_end':
    case 'om_observation_failed':
      return { ...state, omPhase: 'idle' };
    case 'om_reflection_start':
      return { ...state, omPhase: 'reflecting' };
    case 'om_reflection_end':
    case 'om_reflection_failed':
      return { ...state, omPhase: 'idle' };
    case 'om_buffering_start':
      return { ...state, omPhase: 'buffering' };
    case 'om_buffering_end':
    case 'om_buffering_failed':
      return { ...state, omPhase: 'idle' };
    case 'om_activation':
      if (!event.enabled) return { ...state, omPhase: 'idle' };
      return state;

    // Workspace lifecycle.
    case 'workspace_ready':
      return { ...state, workspaceReady: true };
    case 'workspace_error':
      return { ...state, workspaceReady: false };

    // Notices.
    case 'info':
      return pushNotice(state, 'info', event.message);
    case 'error':
      return pushNotice(state, 'error', describeErrorEvent(event));

    default:
      return state;
  }
}

/**
 * Extracts a human-useful message from an `error` event. The error payload can
 * arrive as a string or an object; when the message is missing (e.g. an Error
 * that lost its non-enumerable fields crossing an older server's SSE boundary),
 * fall back to the machine-readable `errorType` rather than a bare "Error".
 */
function describeErrorEvent(event: { error: { message?: string } | string; errorType?: string }): string {
  const message = typeof event.error === 'string' ? event.error : event.error?.message;
  if (message) return message;
  if (event.errorType) return `Run failed (${event.errorType}). Check the server logs for details.`;
  return 'Run failed with an unknown error. Check the server logs for details.';
}

/**
 * Build a fresh transcript from a thread's persisted messages. Used when
 * switching to an existing thread, whose history isn't replayed over the event
 * stream — without this the view renders empty until new events arrive.
 *
 * Mirrors the TUI's history reconstruction: assistant messages interleave text
 * and tool calls in content order, so we emit the running text and each tool
 * call (matched to its result) as part of the same assistant entry.
 */
export function createInitialTranscript({
  messages = [],
  threadId,
  omProgress,
  usage,
}: {
  messages?: MastraDBMessage[];
  threadId?: string;
  omProgress?: AgentControllerOMProgress;
  usage?: UsageSnapshot;
} = {}): TranscriptState {
  return {
    ...initialTranscript,
    entries: messagesToEntries(messages),
    threadId,
    omProgress,
    usage,
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

/**
 * Prepend older history messages to the front of the timeline. `messages` is the
 * newest-N window from a grown history fetch (oldest-first). We keep only the
 * portion strictly older than the oldest message already on screen — anchored on
 * the first existing message entry's id — and prepend those. The overlapping tail
 * of the fetch (messages we already have, including any that streamed in live and
 * later persisted) is discarded, so nothing double-renders. If no anchor is found
 * (e.g. the transcript has no message entries yet) the full window is seeded.
 */
function prependOlderMessages(state: TranscriptState, messages: MastraDBMessage[]): TranscriptState {
  if (messages.length === 0) return state;

  const firstMessageEntry = state.entries.find(e => e.kind === 'message');
  const anchorId = firstMessageEntry?.kind === 'message' ? firstMessageEntry.id : undefined;

  const anchorIndex = anchorId != null ? messages.findIndex(m => m.id === anchorId) : -1;
  // Older messages are everything before the anchor; if the anchor isn't in this
  // window (transcript had no message entries, or the window didn't reach it),
  // treat the whole window as older history to seed.
  const olderMessages = anchorIndex === -1 ? messages : messages.slice(0, anchorIndex);
  if (olderMessages.length === 0) return state;

  return { ...state, entries: [...messagesToEntries(olderMessages), ...state.entries] };
}

function toMessageEntry(
  message: MastraDBMessage,
  options: { streaming?: boolean; steer?: boolean; runtimeTools?: Record<string, ToolCall> } = {},
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
  const displayMessage = isUserSignal ? { ...message, role: 'user' as const } : message;

  return {
    kind: 'message',
    id: message.id,
    message: displayMessage,
    runtimeTools: options.runtimeTools,
    streaming: options.streaming,
    steer: options.steer ?? (isUserSignal ? attributes?.delivery === 'while-active' : undefined),
  };
}

function upsertMessage(state: TranscriptState, message: MastraDBMessage, streaming: boolean): TranscriptState {
  if (message.role !== 'assistant' && message.role !== 'signal') return state;
  const entries = [...state.entries];
  let idx = entries.findIndex(e => e.kind === 'message' && e.id === message.id);
  if (message.role === 'assistant' && idx === -1) {
    const latestIdx = latestAssistantIndex(entries);
    const latest = latestIdx === -1 ? undefined : entries[latestIdx];
    if (latest?.kind === 'message' && latest.message.role === 'assistant' && latest.id.startsWith('assistant-tools-')) {
      idx = latestIdx;
    }
  }
  const prev = idx !== -1 ? entries[idx] : undefined;
  const prevEntry = prev?.kind === 'message' ? prev : undefined;
  const nextMessage = message.role === 'assistant' ? preserveRuntimeToolParts(message, prevEntry?.message) : message;
  const entry = toMessageEntry(nextMessage, { streaming, runtimeTools: prevEntry?.runtimeTools });

  if (message.role === 'assistant') {
    const ownedToolCallIds = new Set(
      nextMessage.content.parts.map(toolCallIdForPart).filter((id): id is string => Boolean(id)),
    );
    if (ownedToolCallIds.size > 0) {
      for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
        if (entryIndex === idx) continue;
        const candidate = entries[entryIndex];
        if (candidate.kind !== 'message' || candidate.message.role !== 'assistant') continue;
        const parts = candidate.message.content.parts.filter(part => {
          const toolCallId = toolCallIdForPart(part);
          return !toolCallId || !ownedToolCallIds.has(toolCallId);
        });
        if (parts.length !== candidate.message.content.parts.length) {
          entries[entryIndex] = {
            ...candidate,
            message: { ...candidate.message, content: { ...candidate.message.content, parts } },
          };
        }
      }
    }
  }

  if (idx === -1) entries.push(entry);
  else entries[idx] = entry;
  return { ...state, entries };
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

/** True when the most recent assistant entry has any visible text. */
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

/** Find the latest assistant entry, creating one if none exists. */
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
  let idx = latestAssistantIndex(entries);
  if (idx === -1) {
    const message: MastraDBMessage = {
      id: `assistant-tools-${Date.now()}`,
      role: 'assistant',
      createdAt: new Date(),
      content: { format: 2, parts: [] },
    };
    entries.push(toMessageEntry(message, { streaming: false }));
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

  return {
    type: 'tool-invocation',
    toolInvocation: {
      state: 'result',
      toolCallId: tool.toolCallId,
      toolName: tool.toolName,
      args: tool.args,
      result: tool.result,
    },
  };
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
