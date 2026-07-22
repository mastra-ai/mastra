/**
 * Output formatters for headless runs. All functions here are pure — they take
 * an event (or a final result) and return strings / plain objects. They never
 * touch `process.*`; the CLI adapter owns the sinks.
 */
import type { AgentControllerEvent, MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';

import type { RunMCResult } from './types.js';

/** Truncate a string to `max` characters, appending "..." if truncated. */
export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

/** Concatenate the text of an assistant message's nested content parts. */
function messageText(message: MastraDBMessage): string {
  return message.content.parts
    .filter((p): p is MastraMessagePart & { text: string } => p.type === 'text' && typeof p.text === 'string')
    .map(p => p.text)
    .join('');
}

/** Mutable per-stream cursor used by {@link formatHuman} to stream assistant text. */
export interface HumanFormatState {
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
    case 'message_update': {
      const fullText = messageText(event.message);
      if (fullText.length > state.lastTextLength) {
        const delta = fullText.slice(state.lastTextLength);
        state.lastTextLength = fullText.length;
        return { stdout: delta };
      }
      return {};
    }
    case 'message_end': {
      // Only assistant messages produce stdout. The controller also emits
      // message_end for the echoed user prompt (and system messages); emitting
      // those here would duplicate the prompt to stdout and corrupt the stream.
      if (event.message.role !== 'assistant') return {};
      // Emit any assistant text the message_update stream didn't already cover
      // (e.g. a run that only delivered the final text on message_end), then
      // terminate the line.
      const fullText = messageText(event.message);
      const delta = fullText.length > state.lastTextLength ? fullText.slice(state.lastTextLength) : '';
      state.lastTextLength = 0;
      return { stdout: delta + '\n' };
    }
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
