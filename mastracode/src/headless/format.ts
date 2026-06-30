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
      const fullText = event.message.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(p => p.text)
        .join('');
      if (fullText.length > state.lastTextLength) {
        const delta = fullText.slice(state.lastTextLength);
        state.lastTextLength = fullText.length;
        return { stdout: delta };
      }
      return {};
    }
    case 'message_end':
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

/**
 * JSONL (stream-json) formatter — returns a plain object to be `JSON.stringify`'d
 * as one line per event by the sink.
 */
export function formatJsonl(event: AgentControllerEvent): Record<string, unknown> {
  return { ...event };
}

/** Render the final result for `--output text`: assistant text, newline-terminated. */
export function renderTextResult(result: RunMCResult): string {
  return result.text.endsWith('\n') ? result.text : result.text + '\n';
}

/** Render the final result for `--output json`: one JSON object. */
export function renderJsonResult(result: RunMCResult): string {
  return (
    JSON.stringify({
      text: result.text,
      finishReason: result.finishReason,
      usage: result.usage,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      error: result.error,
      threadId: result.threadId,
    }) + '\n'
  );
}
