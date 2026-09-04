import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import { SpanType } from '@mastra/core/observability';
import type { SpanRecord } from '@mastra/core/storage';
import { formatHierarchicalSpans } from '@mastra/playground-ui/domains/traces/components/format-hierarchical-spans';
import type { UISpan } from '@mastra/playground-ui/domains/traces/types';

const TOOL_SPAN_TYPES = new Set<string>([
  SpanType.TOOL_CALL,
  SpanType.MCP_TOOL_CALL,
  SpanType.CLIENT_TOOL_CALL,
  SpanType.PROVIDER_TOOL_CALL,
]);

/** Top-level executions started by a tool call (e.g. a workflow tool running its workflow). */
const TOOL_EXECUTION_SPAN_TYPES = new Set<string>([SpanType.WORKFLOW_RUN, SpanType.AGENT_RUN]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTextParts = (content: unknown): MastraMessagePart[] => {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (isRecord(content) && Array.isArray(content.parts)) return toTextParts(content.parts);
  if (!Array.isArray(content)) return [];

  return content.flatMap<MastraMessagePart>(part => {
    if (!isRecord(part)) return [];
    if (part.type === 'text' && typeof part.text === 'string') {
      return [{ type: 'text' as const, text: part.text }];
    }
    if (part.type === 'file' && typeof part.mimeType === 'string' && typeof part.data === 'string') {
      return [{ type: 'file' as const, mimeType: part.mimeType, data: part.data }];
    }
    return [];
  });
};

const getUserParts = (input: unknown): MastraMessagePart[] => {
  if (typeof input === 'string') return toTextParts(input);
  if (isRecord(input) && (input.type === 'user' || input.type === 'user-message')) {
    return toTextParts(input.contents);
  }

  const messages = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.messages)
      ? input.messages
      : [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (isRecord(message) && message.role === 'user') return toTextParts(message.content);
  }

  return [];
};

const getResponseText = (output: unknown): string => {
  if (!isRecord(output)) return '';
  if (typeof output.text === 'string') return output.text;
  if (output.object === undefined) return '';
  return typeof output.object === 'string' ? output.object : JSON.stringify(output.object);
};

const readString = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
};

const toToolPart = (span: SpanRecord): MastraMessagePart => {
  const failed = Boolean(span.error);
  const settled = Boolean(span.endedAt);
  const state = failed ? 'output-error' : settled ? 'result' : 'call';

  return {
    type: 'tool-invocation',
    toolInvocation: {
      toolCallId: readString(span.attributes, 'toolCallId') ?? span.spanId,
      toolName: span.entityName ?? span.entityId ?? span.name,
      args: span.input ?? {},
      state,
      ...(settled ? { result: span.output } : {}),
      ...(failed ? { isError: true, errorText: readString(span.error, 'message') } : {}),
    },
    providerExecuted: span.spanType === SpanType.PROVIDER_TOOL_CALL,
  };
};

/** Model chunk spans whose accumulated content becomes the assistant's response text. */
const RESPONSE_CHUNK_TYPES = new Set(['text', 'object']);

const isResponseChunkSpan = (span: SpanRecord) =>
  span.spanType === SpanType.MODEL_CHUNK && RESPONSE_CHUNK_TYPES.has(readString(span.attributes, 'chunkType') ?? '');

/**
 * Walks the span tree collecting the tool-call parts to render, plus the ids of every span
 * that contributed to the assistant message: tool-call spans and the model chunks that
 * produced the response text.
 */
const collectAssistantSpans = (
  root: UISpan,
  spans: SpanRecord[],
): { parts: MastraMessagePart[]; spanIds: string[] } => {
  const spanById = new Map(spans.map(span => [span.spanId, span]));
  const parts: MastraMessagePart[] = [];
  const spanIds: string[] = [];

  const visit = (nodes: UISpan[]) => {
    for (const node of nodes) {
      const span = spanById.get(node.id);
      if (!span) continue;
      if (TOOL_SPAN_TYPES.has(span.spanType)) {
        parts.push(toToolPart(span));
        spanIds.push(span.spanId);
        // A tool that runs a workflow or an agent gets that top-level execution featured too,
        // so the user can see what the tool call actually did without featuring every nested step.
        for (const child of node.spans ?? []) {
          if (TOOL_EXECUTION_SPAN_TYPES.has(child.type)) spanIds.push(child.id);
        }
        continue;
      }
      if (isResponseChunkSpan(span)) spanIds.push(span.spanId);
      visit(node.spans ?? []);
    }
  };

  visit(root.spans ?? []);
  return { parts, spanIds };
};

const messageContent = (parts: MastraMessagePart[]) =>
  parts.flatMap(part => (part.type === 'text' && typeof part.text === 'string' ? [part.text] : [])).join('\n');

/** A `MastraDBMessage` reconstructed from trace spans, remembering which spans were used to build it. */
export interface TraceViewMastraDBMessage extends MastraDBMessage {
  /** Ids of the spans used to build this message, in visit order (root span first). */
  traceSpanIds: string[];
}

export function formatTraceThreadMessages(spans: SpanRecord[]): TraceViewMastraDBMessage[] {
  const hierarchy = formatHierarchicalSpans(
    spans.map(span => ({
      spanId: span.spanId,
      name: span.name,
      spanType: span.spanType,
      startedAt: span.startedAt,
      endedAt: span.endedAt,
      parentSpanId: span.parentSpanId,
    })),
  );
  const hierarchicalRoot = hierarchy.find(span => span.type === SpanType.AGENT_RUN);
  if (!hierarchicalRoot) return [];
  const root = spans.find(span => span.spanId === hierarchicalRoot.id);
  if (!root) return [];

  const userParts = getUserParts(root.input);
  const responseText = getResponseText(root.output);
  const { parts: assistantParts, spanIds: assistantSpanIds } = collectAssistantSpans(hierarchicalRoot, spans);
  if (responseText) assistantParts.push({ type: 'text', text: responseText });

  return [
    {
      id: `${root.traceId}:${root.spanId}:user`,
      role: 'user',
      createdAt: new Date(root.startedAt),
      threadId: root.threadId ?? undefined,
      content: { format: 2, parts: userParts, content: messageContent(userParts) },
      traceSpanIds: [root.spanId],
    },
    {
      id: `${root.traceId}:${root.spanId}:assistant`,
      role: 'assistant',
      createdAt: new Date(root.endedAt ?? root.startedAt),
      threadId: root.threadId ?? undefined,
      content: { format: 2, parts: assistantParts, content: responseText },
      traceSpanIds: [root.spanId, ...assistantSpanIds],
    },
  ];
}
