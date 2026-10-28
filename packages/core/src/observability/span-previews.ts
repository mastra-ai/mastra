import type { AnyExportedSpan } from './types/tracing';
import { SpanType } from './types/tracing';

/** Maximum preview length, before the trailing `…`, including supplied previews. */
export const PREVIEW_MAX_LENGTH = 100;

export function truncatePreview(text: string, maxLength = PREVIEW_MAX_LENGTH): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLength) return trimmed;
  // Never end on half of a surrogate pair.
  const end = maxLength > 0 && /[\uD800-\uDBFF]/.test(trimmed[maxLength - 1]!) ? maxLength - 1 : maxLength;
  return `${trimmed.slice(0, end)}…`;
}

type RecordValue = Record<string, unknown>;
type Direction = 'input' | 'output';
type PreviewWriter = (span: AnyExportedSpan, direction: Direction) => string | null | undefined;

const record = (value: unknown): RecordValue | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : undefined;
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const limit = (value: string): string => truncatePreview(value) ?? '';

/** Only serialize enough JSON for a preview. Never walk an entire embedding, message history,
 * or tool result just to return 100 characters. Cycles/deep values remain readable. */
function jsonPreview(value: unknown): string {
  let result = '';
  let visited = 0;
  const ancestors = new Set<object>();
  const append = (part: string) => {
    result += part.slice(0, PREVIEW_MAX_LENGTH + 1 - result.length);
  };
  const visit = (item: unknown, depth: number): void => {
    if (result.length > PREVIEW_MAX_LENGTH) return;
    if (++visited > 128) {
      append('"[More values]"');
      return;
    }
    if (typeof item === 'string') {
      append(JSON.stringify(item.slice(0, PREVIEW_MAX_LENGTH + 1)));
    } else if (typeof item === 'bigint') {
      append(JSON.stringify(String(item)));
    } else if (item === null || typeof item !== 'object') {
      append(JSON.stringify(item) ?? 'null');
    } else if (item instanceof Date) {
      append(JSON.stringify(item));
    } else if (ancestors.has(item) || depth >= 8) {
      append(JSON.stringify(ancestors.has(item) ? '[Circular]' : '[Nested value]'));
    } else {
      ancestors.add(item);
      if (Array.isArray(item)) {
        append('[');
        for (let i = 0; i < item.length && result.length <= PREVIEW_MAX_LENGTH; i++) {
          if (i) append(',');
          visit(item[i], depth + 1);
        }
        append(']');
      } else {
        append('{');
        let first = true;
        let keys = 0;
        for (const key in item) {
          if (result.length > PREVIEW_MAX_LENGTH) break;
          if (!Object.hasOwn(item, key)) continue;
          if (++keys > 128) {
            if (!first) append(',');
            append('"…":"[More fields]"');
            break;
          }
          const field = (item as RecordValue)[key];
          if (field === undefined || typeof field === 'function' || typeof field === 'symbol') continue;
          if (!first) append(',');
          first = false;
          append(JSON.stringify(key.slice(0, PREVIEW_MAX_LENGTH + 1)));
          append(':');
          visit(field, depth + 1);
        }
        append('}');
      }
      ancestors.delete(item);
    }
  };
  visit(value, 0);
  return limit(result);
}

function generic(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return limit(value);
  const data = record(value);
  if (data?.__isCreatedSignal === true) return signalPreview(data);
  const content = text(data?.text) ?? text(data?.message);
  return content ? limit(content) : jsonPreview(value);
}

/** Created signals are caller input, rather than messages with a role. */
function signalPreview(signal: RecordValue): string {
  const content = messageContent(signal.contents);
  if (signal.type === 'user' || signal.type === 'user-message') return content;
  const tagName = text(signal.tagName);
  const skillName = text(record(signal.attributes)?.name);
  const label = tagName === 'skill' && skillName ? `Skill ${skillName}` : (tagName ?? text(signal.type) ?? 'signal');
  return limit(content ? `${label}: ${content}` : label);
}

/** Content parts are deliberately shallow: never serialize binary data or an entire tool result. */
function messageContent(value: unknown): string {
  if (typeof value === 'string') return limit(value);
  const container = record(value);
  if (container) return messageContent(container.parts ?? container.content);
  if (!Array.isArray(value)) return '';
  const parts: string[] = [];
  // Prefer the answer over internal reasoning when both are present.
  const hasAnswer = value.some(item => record(item)?.type === 'text' && text(record(item)?.text));
  let length = 0;
  for (const item of value) {
    const part = record(item);
    if (hasAnswer && part?.type === 'reasoning') continue;
    let content = typeof item === 'string' ? limit(item) : text(part?.text);
    if (!content && part) {
      const type = text(part.type);
      if (type === 'step-start') continue;
      if (type === 'reasoning') {
        content = text(part.reasoning);
      } else if (
        type === 'tool-invocation' ||
        type === 'dynamic-tool' ||
        (type?.startsWith('tool-') && type !== 'tool-call' && type !== 'tool-result')
      ) {
        const invocation = record(part.toolInvocation) ?? part;
        const name = text(invocation.toolName) ?? (type?.startsWith('tool-') ? type.slice(5) : undefined) ?? 'unknown';
        const state = text(invocation.state);
        const action =
          state === 'result' || state === 'output-available'
            ? 'tool-result'
            : state === 'output-error'
              ? 'tool-error'
              : state === 'output-denied'
                ? 'tool-denied'
                : state?.startsWith('approval-')
                  ? 'tool-approval'
                  : 'tool-call';
        content = `[${action}: ${name}]`;
      } else if (type === 'tool-call' || type === 'tool-result') {
        content = `[${type}: ${text(part.toolName) ?? 'unknown'}]`;
      } else if (type === 'image' || type === 'image_url' || type === 'input_image') {
        content = '[image]';
      } else if (type === 'audio' || type === 'input_audio') {
        content = '[audio]';
      } else if (type === 'file' || type === 'resource' || type === 'resource_link') {
        content = `[${type}]`;
      } else if (type) {
        content = `[${type}]`;
      }
    }
    if (content) {
      parts.push(limit(content));
      length += content.length + 1;
      if (length > PREVIEW_MAX_LENGTH) break;
    }
  }
  return limit(parts.join(' '));
}

function messages(value: unknown, preferUser: boolean, label = false): string | undefined {
  if (typeof value === 'string') return limit(value);
  const data = record(value);
  if (data && 'messages' in data) return messages(data.messages, preferUser, label);
  const list = Array.isArray(value) ? value : data?.role ? [data] : undefined;
  if (!list) return undefined;
  let latest: string | undefined;
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    const message = record(item);
    const role = typeof item === 'string' ? 'user' : text(message?.role);
    if (!role || role === 'system' || role === 'developer') continue;
    const body = record(message?.content) ?? message;
    let content = typeof item === 'string' ? limit(item) : messageContent(message?.parts ?? message?.content);
    if (!content && Array.isArray(body?.toolInvocations)) {
      content = messageContent(
        body.toolInvocations.map(toolInvocation => ({ type: 'tool-invocation', toolInvocation })),
      );
    }
    if (!content && Array.isArray(body?.experimental_attachments) && body.experimental_attachments.length) {
      content = '[attachment]';
    }
    content ||= text(body?.reasoning) ?? '';
    if (!content) continue;
    const preview = label ? `${role[0]!.toUpperCase()}${role.slice(1)}: ${content}` : content;
    latest ??= preview;
    const signalType = record(record(record(message?.content)?.metadata)?.signal)?.type;
    if (
      !preferUser ||
      role === 'user' ||
      (role === 'signal' && (signalType === 'user' || signalType === 'user-message'))
    ) {
      return preview;
    }
  }
  // A recognized but empty message list should not fall back to serializing its wrappers/binary data.
  return latest ?? '';
}

function toolCalls(value: unknown): string | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  const names = value.slice(0, 4).map(call => {
    const data = record(call);
    return text(data?.toolName) ?? text(data?.name) ?? text(record(data?.function)?.name) ?? 'unknown';
  });
  return `Tool calls: ${names.join(', ')}${value.length > 4 ? ` (+${value.length - 4})` : ''}`;
}

const modelWriter: PreviewWriter = (span, direction) => {
  const value = span[direction];
  const data = record(value);
  if (direction === 'input') {
    if (
      span.type === SpanType.AGENT_RUN &&
      data &&
      (span.metadata?.resumed === true || 'resumeData' in data || 'toolCallId' in data || 'toolName' in data)
    ) {
      return `Resume${text(data.toolName) ? ` ${data.toolName}` : ''}: ${generic(data.resumeData ?? value)}`;
    }
    if (span.type === SpanType.AGENT_RUN && span.metadata?.resumed === true && value != null) {
      return `Resume: ${generic(value)}`;
    }
    const step = span.type === SpanType.MODEL_STEP || span.type === SpanType.MODEL_INFERENCE;
    return messages(value, !step, step);
  }
  if (!data) return undefined;
  if (['suspended', 'aborted', 'interrupted'].includes(String(data.status))) {
    const status = String(data.status);
    return `${status[0]!.toUpperCase()}${status.slice(1)}${text(data.reason) ? `: ${data.reason}` : ''}${text(data.toolName) ? ` (${data.toolName})` : ''}`;
  }
  const tripwire = record(data.tripwire);
  if (tripwire) return `Tripwire${text(tripwire.reason) ? `: ${tripwire.reason}` : ''}`;
  if (data.object != null) return jsonPreview(data.object);
  const calls = toolCalls(data.toolCalls);
  if (text(data.text)) return `${data.text}${calls ? ` — ${calls}` : ''}`;
  if (calls) return calls;
  if (Array.isArray(data.files) && data.files.length) return `${data.files.length} generated file(s)`;
  if (text(data.reasoningText)) return `Reasoning: ${data.reasoningText}`;
  return undefined;
};

const processorWriter: PreviewWriter = (span, direction) => {
  const data = record(span[direction]);
  if (!data) return undefined;
  const phase = record(span.attributes)?.processorPhase;
  if (phase === 'outputStream') {
    return (
      text(data.accumulatedText) ?? (typeof data.totalChunks === 'number' ? `${data.totalChunks} chunks` : undefined)
    );
  }
  if (direction === 'input') {
    if (phase === 'requestError' && text(data.error)) return `Request error: ${data.error}`;
    if (phase === 'toolResult' && text(data.toolName)) return `Tool result: ${data.toolName}`;
    return messages(data.messages ?? data.prompt, phase === 'input' || phase === 'inputStep') ?? text(data.text);
  }
  const changes: string[] = [];
  if (record(data.model)) changes.push(`Model: ${generic(data.model)}`);
  for (const key of ['messages', 'systemMessages', 'tools', 'activeTools', 'toolChoice']) {
    if (Object.hasOwn(data, key)) changes.push(`${key} replaced`);
  }
  if (changes.length) return changes.join('; ');
  if (Object.keys(data).length === 0) return 'No recorded changes';
  return undefined;
};

const processorPhases = new Set([
  'input',
  'inputStep',
  'outputStream',
  'outputResult',
  'outputStep',
  'toolResult',
  'llmRequest',
  'llmResponse',
  'requestError',
]);

const writers: Partial<Record<SpanType, PreviewWriter>> = {
  [SpanType.AGENT_RUN]: modelWriter,
  [SpanType.MODEL_GENERATION]: modelWriter,
  [SpanType.MODEL_STEP]: modelWriter,
  [SpanType.MODEL_INFERENCE]: modelWriter,
  [SpanType.MODEL_CHUNK]: (span, direction) => {
    if (direction !== 'output') return undefined;
    const data = record(span.output);
    if (!data) return undefined;
    if (text(data.text) ?? text(data.delta)) return text(data.text) ?? text(data.delta);
    if (text(data.toolName)) {
      return `${data.toolName}: ${generic(data.toolInput ?? data.args ?? data.input ?? data.result)}`;
    }
    if (record(span.attributes)?.chunkType === 'file') return '[file]';
    return undefined;
  },
  [SpanType.MCP_TOOL_CALL]: mcpWriter,
  [SpanType.MCP_SERVER_REQUEST]: mcpWriter,
  [SpanType.SCORER_RUN]: (span, direction) => {
    const data = record(span[direction]);
    if (!data) return undefined;
    if (direction === 'input' && data.output != null) return `Response: ${generic(data.output)}`;
    if (direction === 'output' && typeof data.score === 'number') {
      return `Score: ${data.score}${text(data.reason) ? ` — ${data.reason}` : ''}`;
    }
    return undefined;
  },
  [SpanType.CLASSIFIER_EVALUATION]: (span, direction) => {
    const data = record(span[direction]);
    return data && (direction === 'input' ? data.questions : data.answers) != null
      ? generic(direction === 'input' ? data.questions : data.answers)
      : undefined;
  },
  [SpanType.RAG_EMBEDDING]: (span, direction) => {
    const value = span[direction];
    if (direction === 'input' && Array.isArray(value)) return `${value.length} texts: ${generic(value[0])}`;
    const data = record(value);
    if (direction === 'output' && typeof data?.dimensions === 'number') return `${data.dimensions} dimensions`;
    return undefined;
  },
  [SpanType.RAG_VECTOR_OPERATION]: returnedWriter,
  [SpanType.RAG_ACTION]: (span, direction) => {
    const data = record(span[direction]);
    if (direction === 'input' && record(span.attributes)?.action === 'rerank' && data?.query != null) {
      return generic(data.query);
    }
    return returnedWriter(span, direction);
  },
  [SpanType.GRAPH_ACTION]: returnedWriter,
};

function returnedWriter(span: AnyExportedSpan, direction: Direction): string | undefined {
  const data = record(span[direction]);
  return direction === 'output' && typeof data?.returned === 'number' ? `${data.returned} results` : undefined;
}

function mcpWriter(span: AnyExportedSpan, direction: Direction): string | undefined {
  if (direction !== 'output') return undefined;
  const data = record(span.output);
  if (data?.structuredContent != null) return jsonPreview(data.structuredContent);
  if (Array.isArray(data?.content)) return messageContent(data.content) || undefined;
  return undefined;
}

function errorPreview(value: unknown): string {
  if (typeof value === 'string') return limit(value);
  const data = record(value);
  if (!data) return '';
  const field = (key: string): string | undefined => {
    try {
      return text(data[key]);
    } catch {
      return undefined;
    }
  };
  const message = field('message');
  const name = field('name');
  if (message) {
    return limit(name && name !== 'Error' && !message.startsWith(`${name}:`) ? `${name}: ${message}` : message);
  }
  return limit(name ?? field('id') ?? field('domain') ?? field('category') ?? '');
}

/** Readable previews of a processed/redacted span. Explicit strings, including
 * empty strings, take precedence. Does not mutate the span or retain snapshots. */
export function buildSpanPreviews(span: AnyExportedSpan): {
  inputPreview: string;
  outputPreview: string;
  errorPreview: string;
} {
  const preview = (direction: Direction): string => {
    try {
      const upstream = span[direction === 'input' ? 'inputPreview' : 'outputPreview'];
      if (typeof upstream === 'string') return limit(upstream);
      if (span[direction] == null) return '';
      const phase = record(span.attributes)?.processorPhase;
      const writer = typeof phase === 'string' && processorPhases.has(phase) ? processorWriter : writers[span.type];
      return limit(writer?.(span, direction) ?? generic(span[direction]));
    } catch {
      // A specialized field may be unreadable while the payload still has useful
      // text. Keep fallback bounded here rather than asking storage to serialize it.
      try {
        return generic(span[direction]);
      } catch {
        // Neither formatter can safely preview this payload.
        return '';
      }
    }
  };
  let error = '';
  try {
    error = typeof span.errorPreview === 'string' ? limit(span.errorPreview) : errorPreview(span.errorInfo);
  } catch {
    // Keep errors bounded and safe; never fall back to serializing stack/details.
  }
  return { inputPreview: preview('input'), outputPreview: preview('output'), errorPreview: error };
}
