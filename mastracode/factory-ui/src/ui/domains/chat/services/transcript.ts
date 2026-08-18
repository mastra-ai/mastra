import type { AgentControllerEvent, AgentControllerTaskSnapshot } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';
import type { MastraDBMessage, MastraMessagePart, TokenUsage } from '@mastra/core/agent-controller';

import { stripAnsi } from './ansi';
import type { OMBudgets } from './runtime';

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
  | MessageEntry
  | NoticeEntry
  | PromptEntry
  | NotificationEntry
  | NotificationSummaryEntry
  | SubagentEntry;

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
  usage?: TokenUsage;
  /** Number of queued follow-up messages. */
  followUpCount: number;
  /** OM progress for the status line (msg/mem budgets), from display_state_changed. */
  omProgress?: OMBudgets;
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
  | { type: 'mergeWindow'; messages: MastraDBMessage[] }
  | {
      type: 'reset';
      threadId?: string;
      omProgress?: OMBudgets;
      usage?: TokenUsage;
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
    case 'mergeWindow':
      return mergeServerWindow(state, action.messages);
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

function applyEvent(state: TranscriptState, event: AgentControllerEvent): TranscriptState {
  if (!isKnownAgentControllerEvent(event)) return state;
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
      const message = event.message;
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
      const usageSnap = event.usage;
      const now = Date.now();
      // usage_update fires at step-finish and carries the completion (and any
      // reasoning) tokens generated during this step. Measure tokens/sec over the
      // decode window only — from the step's first content delta (_decodeStartedAt)
      // to now — which excludes TTFT and inter-step tool/scheduling time. Smooth
      // with an exponential moving average (α=0.3) for a stable readout.
      const stepTokens = usageSnap.completionTokens + (usageSnap.reasoningTokens ?? 0);
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
        usage: ds.tokenUsage ?? state.usage,
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
    case 'om_activation':
      return { ...state, omPhase: 'idle' };

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
  omProgress?: OMBudgets;
  usage?: TokenUsage;
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
 * Reconcile the persisted newest-N window (oldest-first) with the timeline.
 * On-screen messages are anchors — they keep their position, live tool state and
 * streaming flag; the rest are inserted where the window puts them. Insertion
 * runs both ways: load-more delivers older history, revalidation after a route
 * revisit delivers everything the run produced meanwhile.
 */
function mergeServerWindow(state: TranscriptState, messages: MastraDBMessage[]): TranscriptState {
  if (messages.length === 0) return state;

  const reconciled = reconcileToolResults(adoptCoveringWindowCopies(state, messages), messages);
  const onScreenIndex = claimOnScreenEntries(reconciled.entries, messages);

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
    // Out-of-order anchor (the window disagrees with the timeline): leave it
    // where the timeline put it rather than moving rendered content around.
    if (anchorIndex < cursor) continue;
    entries.push(...reconciled.entries.slice(cursor, anchorIndex), ...messagesToEntries(missing));
    missing = [];
    cursor = anchorIndex;
  }
  entries.push(...reconciled.entries.slice(cursor), ...messagesToEntries(missing));

  return { ...reconciled, entries };
}

/**
 * Pair each window message with the entry that already draws it — one anchor per
 * message, so whatever stays unpaired is exactly what the timeline is missing.
 *
 * Identity widens from the persisted id to a shared tool call to the drawn text,
 * because ids alone cannot carry the two shapes the transcript actually sees:
 * the stream sends one assistant message per run while the server persists one
 * per step, and the composer's optimistic echo lives under a `local-…` id the
 * server never confirms (`sendMessage`/`steer` answer nothing). A text pairing
 * is consumed once per entry, so sending the same words twice still draws two
 * bubbles.
 */
function claimOnScreenEntries(entries: TimelineEntry[], messages: MastraDBMessage[]): Map<MastraDBMessage, number> {
  const onScreen = entries.map(indexMessageEntry);
  const anchors = new Map<MastraDBMessage, number>();
  const claimedEntries = new Set<number>();
  const claimedTexts = new Set<string>();

  for (const message of messages) {
    const displayed = toMessageEntry(message).message;
    const toolCallIds = toolCallIdsOf(displayed.content.parts);
    const texts = drawableTexts(displayed);
    const textClaim = (index: number) => `${index} ${texts.join('\n')}`;

    for (const [index, candidate] of onScreen.entries()) {
      if (!candidate) continue;
      const sameMessage =
        candidate.entry.id === message.id || toolCallIds.some(toolCallId => candidate.toolCallIds.has(toolCallId));
      // Whole text parts have to match: a window copy that extends what an SSE
      // gap left on screen still needs inserting for its tail to appear at all.
      const alreadyDrawn =
        toolCallIds.length === 0 &&
        texts.length > 0 &&
        candidate.entry.message.role === displayed.role &&
        texts.every(text => candidate.texts.has(text));

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
  return message.content.parts.flatMap(part =>
    part.type === 'text' && part.text.trim().length > 0 ? [part.text.trim()] : [],
  );
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

/**
 * Adopt the persisted copy of a streamed turn when it strictly extends what is
 * on screen. When the run ends inside an SSE gap the refetched window is the
 * only carrier of the turn's trailing parts (text after the last tool result) —
 * reconcileToolResults alone would heal the tool but drop that text. Adoption
 * only fires when nothing on screen would be lost; a live turn ahead of the
 * snapshot fails the prefix check and keeps its streamed parts.
 */
function adoptCoveringWindowCopies(state: TranscriptState, messages: MastraDBMessage[]): TranscriptState {
  let changed = false;
  const entries = state.entries.map(entry => {
    if (entry.kind !== 'message' || entry.message.role !== 'assistant') return entry;
    const onScreenParts = entry.message.content.parts;
    const toolCallIds = new Set(toolCallIdsOf(onScreenParts));
    const copy = messages.find(
      message =>
        message.role === 'assistant' &&
        (message.id === entry.id ||
          (toolCallIds.size > 0 && toolCallIdsOf(message.content.parts).some(id => toolCallIds.has(id)))),
    );
    if (!copy) return entry;
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

/**
 * True when adopting `persisted` loses nothing from `onScreen`: parts match
 * positionally, text may only extend, tool parts keep their toolCallId and
 * never regress from a terminal state. Snapshot streams mirror the same
 * MessageList that persists, so positional comparison is sound.
 */
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

/**
 * Fold terminal tool results from the refetched window into entries already on
 * screen. The stream can lose a `tool_end` (SSE drop — the server does not
 * replay missed events), leaving an on-screen part stuck at `call` and its row
 * spinning forever. Terminal states never regress, so the server copy wins;
 * everything else (streamed text, live overlay) is left alone.
 */
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

/**
 * Channel provenance for a user signal.
 *
 * `agent-channels` stamps `providerOptions.mastra.channels.<platform>` on every
 * inbound channel message, and `toDataPart` carries that onto the live event's
 * data part — so its presence distinguishes a message that arrived from Slack
 * from one typed into the web composer. Messages sent from the composer never
 * carry it.
 *
 * This matters because the two origins need opposite treatment: see
 * `withRenderableSignalText`.
 */
function isChannelOriginSignal(message: MastraDBMessage): boolean {
  const signal = message.content.metadata?.signal as { providerOptions?: unknown } | undefined;
  const dataPart = (message.content.parts ?? []).find(part => part.type === 'data-user-message') as
    | { data?: { providerOptions?: unknown } }
    | undefined;

  for (const candidate of [signal?.providerOptions, dataPart?.data?.providerOptions]) {
    if (!candidate || typeof candidate !== 'object') continue;
    const mastra = (candidate as { mastra?: unknown }).mastra;
    if (!mastra || typeof mastra !== 'object') continue;
    const channels = (mastra as { channels?: unknown }).channels;
    if (channels && typeof channels === 'object' && Object.keys(channels).length > 0) return true;
  }
  return false;
}

/**
 * A user signal reaches us in two shapes. The persisted message carries ordinary
 * `text` parts, but the live `data-user-message` event carries the signal payload
 * as a single data part and keeps the text inside `data.contents`. Only the first
 * shape has a part the transcript knows how to draw, so a message that arrived
 * from a channel rendered as an empty row until the thread was refetched.
 *
 * Project the data part onto the persisted shape so both paths render the same
 * row — and so the live row does not visibly change when history catches up.
 *
 * Applied to channel-origin signals only (see `isChannelOriginSignal`). A message
 * sent from the web composer is already on screen as an optimistic local echo
 * under a `local-…` id, while this event carries the signal's own id — two ids
 * mean `upsertMessage` cannot dedupe them, so drawing both yields a duplicate
 * bubble. Leaving composer-origin events unrenderable keeps the local echo the
 * single bubble until history replaces it.
 */
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

/** Signal `contents` is either a bare string or the array form produced by `partsToSignalContents`. */
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
  const normalized = isUserSignal && isChannelOriginSignal(message) ? withRenderableSignalText(message) : message;
  const displayMessage = isUserSignal ? { ...normalized, role: 'user' as const } : normalized;

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

/**
 * The entry a tool event belongs to: the one already holding that call, else the
 * latest assistant entry. A run rotates its assistant message on a steer or a
 * goal boundary, so the latest entry alone would move mid-call and split the
 * card in two — one holding the args streamed before the rotation, one after.
 */
function toolAnchorIndex(entries: TimelineEntry[], toolCallId: string): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.kind !== 'message') continue;
    if (entry.runtimeTools?.[toolCallId]) return i;
    if (entry.message.content.parts.some(part => toolCallIdForPart(part) === toolCallId)) return i;
  }
  return latestAssistantIndex(entries);
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
  let idx = toolAnchorIndex(entries, toolCallId);
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

  // isError mirrors what core stamps on persisted result invocations
  // (session-run-engine) — without it the terminal-state render precedence
  // would read a failed live tool as a bare successful `result`.
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
