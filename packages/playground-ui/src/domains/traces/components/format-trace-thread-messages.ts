import type { MastraClient } from '@mastra/client-js';
import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import { SpanType } from '@mastra/core/observability';
import { formatHierarchicalSpans } from '@/domains/traces/components/format-hierarchical-spans';
import type { UISpan } from '@/domains/traces/types';

type SpanRecord = Awaited<ReturnType<MastraClient['getTrace']>>['spans'][number];

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

const OBSERVATIONS_TAG = /<observations>([\s\S]*?)<\/observations>/;

const findGeneratedText = (node: UISpan, spanById: Map<string, SpanRecord>): string => {
  for (const child of node.spans ?? []) {
    const span = spanById.get(child.id);
    if (span?.spanType === SpanType.MODEL_GENERATION) {
      const text = getResponseText(span.output);
      if (text) return text;
    }
    const nested = findGeneratedText(child, spanById);
    if (nested) return nested;
  }
  return '';
};

/** Same tool shape the chat builds from `data-om-*` parts, so the observation badge renders. */
const toObservationPart = (span: SpanRecord, node: UISpan, spanById: Map<string, SpanRecord>): MastraMessagePart => {
  const failed = Boolean(span.error);
  const settled = Boolean(span.endedAt);
  const text = findGeneratedText(node, spanById);
  const observations = (OBSERVATIONS_TAG.exec(text)?.[1] ?? text).trim();
  const inputTokens = span.attributes?.inputTokens;
  const omData = {
    cycleId: span.spanId,
    operationType: readString(span.attributes, 'operationType') === 'reflect' ? 'reflection' : 'observation',
    startedAt: new Date(span.startedAt).toISOString(),
    ...(typeof inputTokens === 'number' ? { tokensObserved: inputTokens } : {}),
    ...(observations ? { observations } : {}),
    ...(settled && span.endedAt
      ? {
          [failed ? 'failedAt' : 'completedAt']: new Date(span.endedAt).toISOString(),
          durationMs: new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime(),
        }
      : {}),
    ...(failed ? { error: readString(span.error, 'message') } : {}),
    _state: failed ? 'failed' : settled ? 'complete' : 'loading',
  };

  return {
    type: 'tool-invocation',
    toolInvocation: {
      toolCallId: `om-${span.spanId}`,
      toolName: 'mastra-memory-om-observation',
      args: omData,
      state: settled ? 'result' : 'call',
      ...(settled ? { result: { omData } } : {}),
    },
  };
};

/** Model chunk spans whose accumulated content becomes the assistant's response text. */
const RESPONSE_CHUNK_TYPES = new Set(['text', 'object']);

const isResponseChunkSpan = (span: SpanRecord) =>
  span.spanType === SpanType.MODEL_CHUNK && RESPONSE_CHUNK_TYPES.has(readString(span.attributes, 'chunkType') ?? '');

interface ToolCallPart {
  part: MastraMessagePart;
  /** The tool-call span plus any top-level execution it started (workflow/agent run). */
  spanIds: string[];
  toolCallId?: string;
  startedAt: SpanRecord['startedAt'];
}

const OM_PROCESSOR_ID = 'observational-memory';
const OM_AGENT_IDS = new Set([
  'observational-memory-observer',
  'observational-memory-reflector',
  'multi-thread-observer',
]);

/** Observational memory machinery (its processor run or its observer/reflector agents) is never part of the chat. */
const isObservationalMemoryInternalSpan = (span: SpanRecord) => {
  if (span.spanType === SpanType.PROCESSOR_RUN) {
    return span.entityId === OM_PROCESSOR_ID || span.name.endsWith(`: ${OM_PROCESSOR_ID}`);
  }
  if (span.spanType === SpanType.AGENT_RUN) {
    return OM_AGENT_IDS.has(span.entityId ?? '') || OM_AGENT_IDS.has(span.entityName ?? '');
  }
  return false;
};

/**
 * Walks the span tree collecting each tool call (with the spans behind it) in visit order,
 * plus the ids of the model chunks that produced the response text.
 */
const collectAssistantSpans = (
  root: UISpan,
  spans: SpanRecord[],
): { tools: ToolCallPart[]; textSpanIds: string[]; resumedOutput: unknown } => {
  const spanById = new Map(spans.map(span => [span.spanId, span]));
  const tools: ToolCallPart[] = [];
  const textSpanIds: string[] = [];
  let resumedOutput: unknown;

  const visit = (nodes: UISpan[]) => {
    for (const node of nodes) {
      const span = spanById.get(node.id);
      if (!span) continue;
      if (TOOL_SPAN_TYPES.has(span.spanType)) {
        // A tool that runs a workflow or an agent gets that top-level execution featured too,
        // so the user can see what the tool call actually did without featuring every nested step.
        const executionIds = (node.spans ?? []).flatMap(child =>
          TOOL_EXECUTION_SPAN_TYPES.has(child.type) ? [child.id] : [],
        );
        const part = toToolPart(span);
        const spanIds = [span.spanId, ...executionIds];
        // A suspended call (e.g. submit_plan) is resumed under the same toolCallId: one call, one part.
        const toolCallId = readString(span.attributes, 'toolCallId');
        const existing = toolCallId ? tools.find(tool => tool.toolCallId === toolCallId) : undefined;
        if (existing) {
          const earlier = new Date(existing.startedAt) <= new Date(span.startedAt);
          if (earlier) existing.part = part;
          existing.spanIds = earlier ? [...existing.spanIds, ...spanIds] : [...spanIds, ...existing.spanIds];
          if (!earlier) existing.startedAt = span.startedAt;
        } else {
          tools.push({ part, spanIds, toolCallId, startedAt: span.startedAt });
        }
        continue;
      }
      // Observational memory runs its own observer/reflector agent: render it as the chat's OM badge
      // and skip its subtree so the observer's output is never mistaken for the assistant's reply.
      const omOperation = readString(span.attributes, 'operationType');
      if (span.spanType === SpanType.MEMORY_OPERATION && (omOperation === 'observe' || omOperation === 'reflect')) {
        tools.push({
          part: toObservationPart(span, node, spanById),
          spanIds: [span.spanId],
          startedAt: span.startedAt,
        });
        continue;
      }
      if (isObservationalMemoryInternalSpan(span)) continue;
      if (isResponseChunkSpan(span)) textSpanIds.push(span.spanId);
      // A suspended run resumes as a nested agent run (outside any tool call) that carries the final response.
      if (span.spanType === SpanType.AGENT_RUN) resumedOutput = span.output;
      visit(node.spans ?? []);
    }
  };

  visit(root.spans ?? []);
  return { tools, textSpanIds, resumedOutput };
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
  const { tools, textSpanIds, resumedOutput } = collectAssistantSpans(hierarchicalRoot, spans);
  const responseText = getResponseText(root.output) || getResponseText(resumedOutput);
  const assistantCreatedAt = new Date(root.endedAt ?? root.startedAt);
  const threadId = root.threadId ?? undefined;

  const messages: TraceViewMastraDBMessage[] = [
    {
      id: `${root.traceId}:${root.spanId}:user`,
      role: 'user',
      createdAt: new Date(root.startedAt),
      threadId,
      content: { format: 2, parts: userParts, content: messageContent(userParts) },
      traceSpanIds: [root.spanId],
    },
    // One message per tool call so each part maps to exactly the spans behind it.
    ...tools.map<TraceViewMastraDBMessage>(({ part, spanIds }) => ({
      id: `${root.traceId}:${spanIds[0]}:tool`,
      role: 'assistant',
      createdAt: assistantCreatedAt,
      threadId,
      content: { format: 2, parts: [part], content: '' },
      traceSpanIds: [root.spanId, ...spanIds],
    })),
  ];

  if (responseText) {
    messages.push({
      id: `${root.traceId}:${root.spanId}:assistant`,
      role: 'assistant',
      createdAt: assistantCreatedAt,
      threadId,
      content: { format: 2, parts: [{ type: 'text', text: responseText }], content: responseText },
      traceSpanIds: [root.spanId, ...textSpanIds],
    });
  }

  return messages;
}
