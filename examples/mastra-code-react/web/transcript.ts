import { harnessMessageText } from '@mastra/client-js';
import type { HarnessEvent, KnownHarnessEvent, HarnessMessage, HarnessTaskSnapshot } from '@mastra/client-js';

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

export interface AssistantEntry {
  kind: 'assistant';
  id: string;
  text: string;
  tools: ToolCall[];
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

export type PromptEntry = ApprovalPrompt | SuspensionPrompt;
export type TimelineEntry = UserEntry | AssistantEntry | NoticeEntry | PromptEntry;

export interface TranscriptState {
  entries: TimelineEntry[];
  /** Whether the agent is mid-run. */
  running: boolean;
  modeId?: string;
  modelId?: string;
  threadId?: string;
  /** Current task list from task_updated events. */
  tasks: HarnessTaskSnapshot[];
}

export const initialTranscript: TranscriptState = { entries: [], running: false, tasks: [] };

let noticeSeq = 0;

type Action =
  | { type: 'event'; event: HarnessEvent }
  | { type: 'localUser'; text: string; steer?: boolean }
  | { type: 'resolvePrompt'; id: string }
  | { type: 'reset'; modeId?: string; modelId?: string; threadId?: string };

export function transcriptReducer(state: TranscriptState, action: Action): TranscriptState {
  switch (action.type) {
    case 'reset':
      return { entries: [], running: false, tasks: [], modeId: action.modeId, modelId: action.modelId, threadId: action.threadId };
    case 'localUser':
      return {
        ...state,
        entries: [...state.entries, { kind: 'user', id: `local-${Date.now()}-${noticeSeq++}`, text: action.text, steer: action.steer }],
      };
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
      return { ...state, running: true };
    case 'agent_end':
      return { ...state, running: false };

    case 'message_start':
    case 'message_update':
    case 'message_end':
      return upsertAssistant(state, event.message);

    case 'tool_input_start':
      return withTool(state, event.toolCallId, t => ({ ...t, toolName: event.toolName }), {
        toolName: event.toolName,
      });
    case 'tool_input_delta':
      return withTool(state, event.toolCallId, t => ({ ...t, argsText: t.argsText + event.argsTextDelta }));
    case 'tool_start':
      return withTool(state, event.toolCallId, t => ({ ...t, toolName: event.toolName, args: event.args, status: 'running' }), {
        toolName: event.toolName,
        args: event.args,
      });
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

    case 'info':
      return pushNotice(state, 'info', event.message);
    case 'error':
      return pushNotice(state, 'error', typeof event.error === 'string' ? event.error : event.error?.message ?? 'Error');

    default:
      return state;
  }
}

function upsertAssistant(state: TranscriptState, message: HarnessMessage): TranscriptState {
  if (message.role !== 'assistant') return state;
  const text = harnessMessageText(message);
  const entries = [...state.entries];
  const idx = entries.findIndex(e => e.kind === 'assistant' && e.id === message.id);
  if (idx === -1) {
    entries.push({ kind: 'assistant', id: message.id, text, tools: [] });
  } else {
    entries[idx] = { ...(entries[idx] as AssistantEntry), text };
  }
  return { ...state, entries };
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
    entries.push({ kind: 'assistant', id: `assistant-tools-${Date.now()}`, text: '', tools: [] });
    idx = entries.length - 1;
  }
  const assistant = entries[idx] as AssistantEntry;
  const tools = [...assistant.tools];
  let tIdx = tools.findIndex(t => t.toolCallId === toolCallId);
  if (tIdx === -1) {
    tools.push({
      toolCallId,
      toolName: seed?.toolName ?? 'tool',
      argsText: '',
      args: seed?.args,
      status: 'running',
      output: '',
    });
    tIdx = tools.length - 1;
  }
  tools[tIdx] = update(tools[tIdx]);
  entries[idx] = { ...assistant, tools };
  return { ...state, entries };
}

function pushPrompt(state: TranscriptState, prompt: PromptEntry): TranscriptState {
  if (state.entries.some(e => 'id' in e && e.id === prompt.id)) return state;
  return { ...state, entries: [...state.entries, prompt] };
}

function pushNotice(state: TranscriptState, level: 'info' | 'error', text: string): TranscriptState {
  return { ...state, entries: [...state.entries, { kind: 'notice', id: `notice-${Date.now()}-${noticeSeq++}`, level, text }] };
}
