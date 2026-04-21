import type { SpanRecord } from '@mastra/core/storage';
import { format, isToday, isYesterday } from 'date-fns';

/** Extract a readable input preview from the root span's input field */
export function extractInputPreview(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;

  // Unwrap { messages: [...] } wrapper from agent spans
  let messages: unknown[] | undefined;
  if (Array.isArray(input)) {
    messages = input;
  } else if (input && typeof input === 'object' && 'messages' in input) {
    const wrapped = (input as Record<string, unknown>).messages;
    if (Array.isArray(wrapped)) messages = wrapped;
  }

  if (messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as Record<string, unknown> | undefined;
      if (msg?.role === 'user') {
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) {
          const textPart = (msg.content as Array<Record<string, unknown>>).find(p => p.type === 'text');
          if (typeof textPart?.text === 'string') return textPart.text;
        }
      }
    }
    const last = messages[messages.length - 1] as Record<string, unknown> | string | undefined;
    if (typeof last === 'string') return last;
    if (last && typeof last.content === 'string') return last.content;
  }

  return '';
}

/** Extract the raw input for dataset item (unwrap agent message wrapper) */
export function extractRawInput(trace: SpanRecord): unknown {
  if (trace.input == null) return {};
  const spanInput = trace.input as Record<string, unknown> | undefined;
  const isWrappedAgentInput =
    trace.spanType === 'agent_run' &&
    spanInput &&
    typeof spanInput === 'object' &&
    !Array.isArray(spanInput) &&
    'messages' in spanInput;
  return isWrappedAgentInput ? (spanInput.messages ?? trace.input) : trace.input;
}

/** Extract output text preview from root span output */
export function extractOutputPreview(output: unknown): string {
  if (!output) return '';
  if (typeof output === 'string') return output;
  if (typeof output === 'object' && output !== null) {
    const obj = output as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (obj.object) return JSON.stringify(obj.object).slice(0, 200);
  }
  return '';
}

export function formatDuration(startedAt: Date | string, endedAt: Date | string | null | undefined): string {
  if (!endedAt) return '...';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function formatTimestamp(date: Date): string {
  if (isToday(date)) return format(date, 'h:mm:ss a');
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d, h:mm a');
}

/** Extract error text from a trace span */
export function extractErrorText(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    return (error as { message?: string })?.message || 'Error';
  }
  return 'Error';
}
