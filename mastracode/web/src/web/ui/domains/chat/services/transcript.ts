import type { AgentControllerEvent, KnownAgentControllerEvent, AgentControllerMessage } from '@mastra/client-js';
import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent';

import { toMastraDBMessage } from './agent-controller-message-accumulator';

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
}

export const initialTranscript: TranscriptState = {
  entries: [],
  running: false,
  pending: false,
};

let noticeSeq = 0;

type Action =
  | { type: 'event'; event: AgentControllerEvent }
  | { type: 'localUser'; text: string; steer?: boolean }
  | { type: 'localNotice'; text: string; level: 'info' | 'error' }
  | { type: 'resolvePrompt'; id: string };

export function transcriptReducer(state: TranscriptState, action: Action): TranscriptState {
  switch (action.type) {
    case 'localUser':
      return {
        ...state,
        pending: true,
        entries: [
          ...state.entries,
          toMessageEntry(
            toMastraDBMessage({
              id: `local-${Date.now()}-${noticeSeq++}`,
              role: 'user',
              content: [{ type: 'text', text: action.text }],
            }),
            { steer: action.steer },
          ),
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

function applyEvent(state: TranscriptState, raw: AgentControllerEvent): TranscriptState {
  const event = raw as KnownAgentControllerEvent;
  switch (event.type) {
    case 'agent_start':
      return { ...state, running: true };
    case 'agent_end':
      return { ...state, running: false, pending: false };

    case 'message_start':
    case 'message_update':
      return { ...upsertAssistant(state, event.message, true), pending: false };
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
export function createInitialTranscript({ messages = [] }: { messages?: AgentControllerMessage[] } = {}): TranscriptState {
  return { ...initialTranscript, entries: messagesToEntries(messages) };
}

function messagesToEntries(messages: AgentControllerMessage[]): TimelineEntry[] {
  return messages.map(message => toMessageEntry(toMastraDBMessage(message), { streaming: false }));
}

function toMessageEntry(
  message: MastraDBMessage,
  options: { streaming?: boolean; steer?: boolean; runtimeTools?: Record<string, ToolCall> } = {},
): MessageEntry {
  return {
    kind: 'message',
    id: message.id,
    message,
    runtimeTools: options.runtimeTools,
    streaming: options.streaming,
    steer: options.steer,
  };
}

function upsertAssistant(state: TranscriptState, message: AgentControllerMessage, streaming: boolean): TranscriptState {
  if (message.role !== 'assistant') return state;
  const entries = [...state.entries];
  let idx = entries.findIndex(e => e.kind === 'message' && e.message.role === 'assistant' && e.id === message.id);
  if (idx === -1) {
    const latestIdx = latestAssistantIndex(entries);
    const latest = latestIdx === -1 ? undefined : entries[latestIdx];
    if (latest?.kind === 'message' && latest.message.role === 'assistant' && latest.id.startsWith('assistant-tools-')) {
      idx = latestIdx;
    }
  }
  const prev = idx !== -1 ? entries[idx] : undefined;
  const prevEntry = prev?.kind === 'message' ? prev : undefined;
  const nextMessage = preserveRuntimeToolParts(toMastraDBMessage(message), prevEntry?.message);
  const entry = toMessageEntry(nextMessage, { streaming, runtimeTools: prevEntry?.runtimeTools });

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
    const message = toMastraDBMessage({
      id: `assistant-tools-${Date.now()}`,
      role: 'assistant',
      content: [],
    });
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
