/**
 * Output formatters for headless runs. All functions here are pure — they take
 * an event (or a final result) and return strings / plain objects. They never
 * touch `process.*`; the CLI adapter owns the sinks.
 */
import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import type { RunMCResult } from './types.js';

/** Truncate a string to `max` characters, appending "..." if truncated. */
export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

/** Mutable per-stream cursor used by {@link formatHuman} to stream assistant text. */
export interface HumanFormatState {
  activeAssistantMessageId?: string;
  lastTextLength: number;
}

export function createHumanFormatState(): HumanFormatState {
  return { lastTextLength: 0 };
}

/** A chunk of formatted output destined for stdout and/or stderr. */
export interface FormattedOutput {
  stdout?: string;
  stderr?: string;
}

/**
 * Human-readable streaming formatter (the historical default). Assistant text
 * streams to stdout; tool/subagent/shell/error activity goes to stderr. The
 * `state` cursor is mutated so repeated `message_update` events only emit the
 * newly-appended text.
 */
export function formatHuman(event: AgentControllerEvent, state: HumanFormatState): FormattedOutput {
  switch (event.type) {
    case 'agent_start':
      state.lastTextLength = 0;
      return {};
    case 'message_start':
      if (event.message.role === 'assistant') {
        state.activeAssistantMessageId = event.message.id;
        state.lastTextLength = 0;
      }
      return {};
    case 'message_update':
      if (event.event.type !== 'text-delta' || event.id !== state.activeAssistantMessageId || !event.event.delta)
        return {};
      state.lastTextLength += event.event.delta.length;
      return { stdout: event.event.delta };
    case 'message_end':
      if (event.id !== state.activeAssistantMessageId) return {};
      state.activeAssistantMessageId = undefined;
      if (state.lastTextLength === 0) return {};
      state.lastTextLength = 0;
      return { stdout: '\n' };
    case 'tool_start':
      return { stderr: `[tool] ${event.toolName}\n` };
    case 'tool_end':
      return event.isError ? { stderr: `[tool error] ${truncate(String(event.result), 200)}\n` } : {};
    case 'shell_output':
      return { stderr: event.output };
    case 'subagent_start':
      return {
        stderr: `[subagent:${event.forked ? 'forked:' : ''}${event.agentType}] ${truncate(event.task, 100)}\n`,
      };
    case 'subagent_end':
      return event.isError ? { stderr: `[subagent error] ${truncate(event.result, 200)}\n` } : {};
    case 'error':
      return { stderr: `[error] ${event.error.message}\n` };
    default:
      return {};
  }
}

/** Convert an `Error` instance into a JSON-serializable plain object. */
function serializeError(err: Error): { name: string; message: string; stack?: string } {
  return { name: err.name, message: err.message, stack: err.stack };
}

/**
 * Event types left out of `--output jsonl`. `display_state_changed` carries a
 * full snapshot of the session's UI state and is re-sent after almost every
 * other event, so each line repeats the whole conversation, including large
 * tool results and shell output. A long run writes gigabytes of these lines,
 * and the stream's other events already carry everything they contain.
 */
const JSONL_EXCLUDED_EVENT_TYPES = new Set<AgentControllerEvent['type']>(['display_state_changed']);

/** Whether `--output jsonl` writes this event. Only `display_state_changed` is skipped. */
export function isJsonlEvent(event: AgentControllerEvent): boolean {
  return !JSONL_EXCLUDED_EVENT_TYPES.has(event.type);
}

/**
 * JSONL (stream-json) formatter — returns a plain object to be `JSON.stringify`'d
 * as one line per event by the sink. `Error` instances are normalized so their
 * `name`/`message`/`stack` survive serialization (`JSON.stringify` turns a raw
 * `Error` into `{}`).
 */
export function formatJsonl(event: AgentControllerEvent): Record<string, unknown> {
  const out: Record<string, unknown> = { ...event };
  if ('error' in event && event.error instanceof Error) {
    out.error = serializeError(event.error);
  }
  return out;
}

/** Render the final result for `--output text`: assistant text, newline-terminated. */
export function renderTextResult(result: RunMCResult): string {
  return result.text.endsWith('\n') ? result.text : result.text + '\n';
}

/** Render the final result for `--output json`: one JSON object. */
export function renderJsonResult(result: RunMCResult): string {
  return (
    JSON.stringify({
      status: result.status,
      text: result.text,
      finishReason: result.finishReason,
      usage: result.usage,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      error: result.error,
      threadId: result.threadId,
      exitCode: result.exitCode,
    }) + '\n'
  );
}
