import { harnessMessageText } from '@mastra/client-js';
import type {
  HarnessEvent,
  KnownHarnessEvent,
  HarnessMessage,
  HarnessTaskSnapshot,
  HarnessOMProgress,
} from '@mastra/client-js';

/**
 * Transcript model + reducer.
 *
 * Folds the harness event stream into an ordered list of timeline entries the
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
 * An ordered piece of an assistant turn. The harness streams an assistant
 * message whose `content[]` interleaves text, thinking, and tool_call parts in
 * execution order; we mirror that order here so the UI renders
 * text → tool → text → tool exactly as it happened (matching the TUI), rather
 * than collapsing all text into one blob and bucketing tools at the end.
 *
 * Tool segments hold only the tool id; the live tool state (args/output/
 * status/result, which arrives on separate tool_* events) lives in the entry's
 * `toolsById` map and is resolved at render time.
 */
export type AssistantSegment =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; toolCallId: string };

export interface AssistantEntry {
  kind: 'assistant';
  id: string;
  /** Ordered text / thinking / tool segments, in execution order. */
  segments: AssistantSegment[];
  /** Live tool state keyed by tool-call id, referenced by tool segments. */
  toolsById: Record<string, ToolCall>;
  /** True while the model is still generating tokens for this message. */
  streaming: boolean;
}

export interface UserEntry {
  kind: 'user';
  id: string;
  text: string;
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
  | UserEntry
  | AssistantEntry
  | NoticeEntry
  | PromptEntry
  | NotificationEntry
  | NotificationSummaryEntry
  | SubagentEntry;

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
  /** Whether the agent is mid-run (driven by agent_start/agent_end events). */
  running: boolean;
  /**
   * Whether a turn the user just initiated is awaiting its first response.
   * Set the instant the user sends/steers (synchronously, before any SSE
   * events), and cleared once the agent finishes or streams its first token.
   * This makes the "thinking" indicator and Stop button latch reliably even
   * when the run's start/end events arrive in a single batched flush.
   */
  pending: boolean;
  modeId?: string;
  modelId?: string;
  threadId?: string;
  /** Current task list from task_updated events. */
  tasks: HarnessTaskSnapshot[];
  /** Accumulated token usage. */
  usage?: UsageSnapshot;
  /** Number of queued follow-up messages. */
  followUpCount: number;
  /** OM progress for the status line (msg/mem budgets), from display_state_changed. */
  omProgress?: HarnessOMProgress;
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
  running: false,
  pending: false,
  tasks: [],
  followUpCount: 0,
  omPhase: 'idle',
  tokensPerSec: 0,
  _decodeStartedAt: 0,
};

let noticeSeq = 0;

type Action =
  | { type: 'event'; event: HarnessEvent }
  | { type: 'localUser'; text: string; steer?: boolean }
  | { type: 'localNotice'; text: string; level: 'info' | 'error' }
  | { type: 'resolvePrompt'; id: string }
  | {
      type: 'reset';
      modeId?: string;
      modelId?: string;
      threadId?: string;
      omProgress?: HarnessOMProgress;
      usage?: UsageSnapshot;
    }
  | {
      type: 'hydrate';
      messages: HarnessMessage[];
      modeId?: string;
      modelId?: string;
      threadId?: string;
      omProgress?: HarnessOMProgress;
      usage?: UsageSnapshot;
    };

export function transcriptReducer(state: TranscriptState, action: Action): TranscriptState {
  switch (action.type) {
    case 'reset':
      return {
        ...initialTranscript,
        modeId: action.modeId,
        modelId: action.modelId,
        threadId: action.threadId,
        omProgress: action.omProgress,
        usage: action.usage,
      };
    case 'hydrate':
      return hydrate(action.messages, action.modeId, action.modelId, action.threadId, action.omProgress, action.usage);
    case 'localUser':
      return {
        ...state,
        pending: true,
        entries: [
          ...state.entries,
          { kind: 'user', id: `local-${Date.now()}-${noticeSeq++}`, text: action.text, steer: action.steer },
        ],
      };
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

function applyEvent(state: TranscriptState, raw: HarnessEvent): TranscriptState {
  const event = raw as KnownHarnessEvent;
  switch (event.type) {
    case 'agent_start':
      // Reset the rate at the start of a new turn (not at the end) so the last
      // turn's tokens/sec stays visible while idle — short single-step turns
      // would otherwise zero it before it could be read.
      return { ...state, running: true, tokensPerSec: 0, _decodeStartedAt: 0 };
    case 'agent_end':
      // Keep tokensPerSec as the last turn's reading; only clear the in-flight
      // decode window so a stale start can't bleed into the next turn.
      return { ...state, running: false, pending: false, _decodeStartedAt: 0 };

    case 'message_start':
    case 'message_update': {
      const next = upsertAssistant(state, event.message, true);
      // Mark the start of decoding for the current step on the first streamed
      // content delta, so tokens/sec is measured over decode time only (it
      // excludes TTFT before this point and tool gaps between steps). usage_update
      // at step-finish closes this window and re-arms it for the next step.
      const decoded = next._decodeStartedAt > 0 ? next : { ...next, _decodeStartedAt: Date.now() };
      // First streamed assistant content clears the "thinking" pending state.
      return hasAssistantText(decoded) ? { ...decoded, pending: false } : decoded;
    }
    case 'message_end':
      return { ...upsertAssistant(state, event.message, false), pending: false };

    case 'tool_input_start':
      return withTool(state, event.toolCallId, t => ({ ...t, toolName: event.toolName }), {
        toolName: event.toolName,
      });
    case 'tool_input_delta':
      return withTool(state, event.toolCallId, t => ({ ...t, argsText: t.argsText + event.argsTextDelta }));
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
      return withTool(state, event.toolCallId, t => ({ ...t, output: t.output + event.output }));
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
      return { ...state, modeId: event.modeId };
    case 'model_changed':
      return { ...state, modelId: event.modelId };
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

    // Thread lifecycle.
    case 'thread_created':
      return pushNotice(state, 'info', `Created thread: ${event.thread.title || event.thread.id}`);
    case 'thread_deleted':
      return pushNotice(state, 'info', `Deleted thread ${event.threadId}`);

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
        const decodeSec = (now - state._decodeStartedAt) / 1000;
        if (decodeSec > 0) {
          const instantaneous = stepTokens / decodeSec;
          const alpha = 0.3;
          tps =
            state.tokensPerSec > 0
              ? Math.round(alpha * instantaneous + (1 - alpha) * state.tokensPerSec)
              : Math.round(instantaneous);
        }
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
      return pushNotice(
        state,
        'error',
        typeof event.error === 'string' ? event.error : (event.error?.message ?? 'Error'),
      );

    default:
      return state;
  }
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
function hydrate(
  messages: HarnessMessage[],
  modeId?: string,
  modelId?: string,
  threadId?: string,
  omProgress?: HarnessOMProgress,
  usage?: UsageSnapshot,
): TranscriptState {
  const entries: TimelineEntry[] = [];
  for (const message of messages) {
    if (message.role === 'user') {
      entries.push({ kind: 'user', id: message.id, text: harnessMessageText(message) });
    } else if (message.role === 'assistant') {
      const { segments, toolsById } = buildSegments(message);
      entries.push({ kind: 'assistant', id: message.id, segments, toolsById, streaming: false });
    }
    // 'system' messages aren't shown in the transcript.
  }
  return { ...initialTranscript, entries, modeId, modelId, threadId, omProgress, usage };
}

/**
 * Walk a message's content parts in order and produce ordered segments plus the
 * tool state they reference. `prevTools` carries forward live tool runtime
 * (streamed argsText / shell output / status) captured from tool_* events,
 * which the persisted content parts don't include.
 *
 * This mirrors the TUI's `AssistantMessageComponent`, which renders each
 * content part where it appears instead of concatenating text and grouping
 * tools.
 */
function buildSegments(
  message: HarnessMessage,
  prevTools: Record<string, ToolCall> = {},
): { segments: AssistantSegment[]; toolsById: Record<string, ToolCall> } {
  const segments: AssistantSegment[] = [];
  const toolsById: Record<string, ToolCall> = {};
  let toolSeq = 0;
  for (const part of message.content) {
    if (part.type === 'text' && typeof part.text === 'string') {
      if (part.text.length > 0) segments.push({ kind: 'text', text: part.text });
    } else if (part.type === 'thinking' && typeof part.thinking === 'string') {
      if (part.thinking.trim().length > 0) segments.push({ kind: 'thinking', text: part.thinking });
    } else if (part.type === 'tool_call') {
      const toolCallId = part.id ?? `${message.id}-tool-${toolSeq++}`;
      const result = message.content.find(c => c.type === 'tool_result' && c.id === part.id);
      const prev = prevTools[toolCallId];
      toolsById[toolCallId] = {
        toolCallId,
        toolName: part.name ?? prev?.toolName ?? 'tool',
        // Keep streamed args text; fall back to nothing.
        argsText: prev?.argsText ?? '',
        args: part.args ?? prev?.args,
        // A present tool_result means the call resolved; otherwise keep the
        // live status (running) seeded from tool_* events.
        status: result ? (result.isError ? 'error' : 'done') : (prev?.status ?? 'running'),
        result: result?.result ?? prev?.result,
        output: prev?.output ?? '',
      };
      segments.push({ kind: 'tool', toolCallId });
    }
    // 'tool_result' parts are folded into their tool_call above.
  }
  return { segments, toolsById };
}

function upsertAssistant(state: TranscriptState, message: HarnessMessage, streaming: boolean): TranscriptState {
  if (message.role !== 'assistant') return state;
  const entries = [...state.entries];
  const idx = entries.findIndex(e => e.kind === 'assistant' && e.id === message.id);
  const prev = idx !== -1 ? (entries[idx] as AssistantEntry) : undefined;
  const { segments, toolsById } = buildSegments(message, prev?.toolsById);

  // Preserve any tools (and their segments) that arrived via tool_* events but
  // aren't yet reflected in the streamed content — keeps a tool visible the
  // instant it starts, before the next message_update lands.
  if (prev) {
    for (const seg of prev.segments) {
      if (seg.kind === 'tool' && !toolsById[seg.toolCallId]) {
        segments.push(seg);
        const carried = prev.toolsById[seg.toolCallId];
        if (carried) toolsById[seg.toolCallId] = carried;
      }
    }
  }

  const entry: AssistantEntry = { kind: 'assistant', id: message.id, segments, toolsById, streaming };
  if (idx === -1) entries.push(entry);
  else entries[idx] = entry;
  return { ...state, entries };
}

/** True when the most recent assistant entry has any visible text. */
function hasAssistantText(state: TranscriptState): boolean {
  const idx = latestAssistantIndex(state.entries);
  if (idx === -1) return false;
  const entry = state.entries[idx];
  if (entry.kind !== 'assistant') return false;
  return entry.segments.some(s => s.kind === 'text' && s.text.trim().length > 0);
}

/** Find the latest assistant entry, creating one if none exists. */
function latestAssistantIndex(entries: TimelineEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].kind === 'assistant') return i;
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
    entries.push({
      kind: 'assistant',
      id: `assistant-tools-${Date.now()}`,
      segments: [],
      toolsById: {},
      streaming: false,
    });
    idx = entries.length - 1;
  }
  const assistant = entries[idx] as AssistantEntry;
  const toolsById = { ...assistant.toolsById };
  const existing = toolsById[toolCallId] ?? {
    toolCallId,
    toolName: seed?.toolName ?? 'tool',
    argsText: '',
    args: seed?.args,
    status: 'running' as const,
    output: '',
  };
  toolsById[toolCallId] = update(existing);

  // Ensure a tool segment exists in execution order. A tool's first event can
  // arrive before the message_update that would place it from content, so we
  // append the segment here to keep it inline at the point it started.
  const segments = assistant.segments.some(s => s.kind === 'tool' && s.toolCallId === toolCallId)
    ? assistant.segments
    : [...assistant.segments, { kind: 'tool' as const, toolCallId }];

  entries[idx] = { ...assistant, segments, toolsById };
  return { ...state, entries };
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
