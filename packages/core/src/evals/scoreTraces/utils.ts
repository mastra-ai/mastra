import type { MastraDBMessage } from '../../agent';
import { SpanType } from '../../observability';
import type { SpanRecord, TraceRecord } from '../../storage';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../types';

// // Span tree structure for efficient lookups
interface SpanTree {
  spanMap: Map<string, SpanRecord>;
  childrenMap: Map<string, SpanRecord[]>;
  rootSpans: SpanRecord[];
}

/**
 * Build a hierarchical span tree with efficient lookup maps
 */
export function buildSpanTree(spans: SpanRecord[]): SpanTree {
  const spanMap = new Map<string, SpanRecord>();
  const childrenMap = new Map<string, SpanRecord[]>();
  const rootSpans: SpanRecord[] = [];

  // First pass: build span map
  for (const span of spans) {
    spanMap.set(span.spanId, span);
  }

  // Second pass: build parent-child relationships
  for (const span of spans) {
    if (span.parentSpanId === null) {
      rootSpans.push(span);
    } else {
      const siblings = childrenMap.get(span.parentSpanId) || [];
      siblings.push(span);
      childrenMap.set(span.parentSpanId, siblings);
    }
  }

  // Sort children by startedAt timestamp for temporal ordering
  for (const children of childrenMap.values()) {
    children.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  }

  // Sort root spans by startedAt
  rootSpans.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  return { spanMap, childrenMap, rootSpans };
}

/**
 * Extract children spans of a specific type
 */
function getChildrenOfType<T extends SpanRecord>(spanTree: SpanTree, parentSpanId: string, spanType: SpanType): T[] {
  const children = spanTree.childrenMap.get(parentSpanId) || [];
  return children.filter(span => span.spanType === spanType) as T[];
}

/**
 * Normalize message content to string format
 * For arrays with multiple text parts, returns only the last text part (AI SDK convention)
 */
function normalizeMessageContent(content: string | Array<{ type: string; text: string }>): string {
  if (typeof content === 'string') {
    return content;
  }

  // Extract text parts and return only the last one (AI SDK convention)
  const textParts = content.filter(part => part.type === 'text');
  return textParts.length > 0 ? textParts[textParts.length - 1]?.text || '' : '';
}

/**
 * Create MastraDBMessage directly from span message data
 */
function createMastraDBMessage(
  message: { role: string; content: string | Array<{ type: string; text: string }> },
  createdAt: Date,
  id: string = '',
): MastraDBMessage {
  const contentText = normalizeMessageContent(message.content);
  const role = message.role as 'user' | 'assistant' | 'system';

  return {
    id,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text: contentText }],
      content: contentText,
    },
    createdAt: new Date(createdAt),
  };
}

/**
 * Extract input messages from agent run span
 */
function extractInputMessages(agentSpan: SpanRecord): MastraDBMessage[] {
  const input = agentSpan.input;

  // Handle different input formats
  if (typeof input === 'string') {
    return [
      createMastraDBMessage(
        {
          role: 'user',
          content: input,
        },
        agentSpan.startedAt,
      ),
    ];
  }

  if (Array.isArray(input)) {
    return input.map(msg => createMastraDBMessage(msg, agentSpan.startedAt));
  }

  // @ts-ignore
  if (input && typeof input === 'object' && Array.isArray(input.messages)) {
    // @ts-ignore
    return input.messages.map((msg: any) => createMastraDBMessage(msg, agentSpan.startedAt));
  }
  return [];
}

/**
 * Extract system messages from LLM span
 */
function extractSystemMessages(llmSpan: SpanRecord): Array<{ role: 'system'; content: string }> {
  return (llmSpan.input?.messages || [])
    .filter((msg: any) => msg.role === 'system')
    .map((msg: any) => ({
      role: 'system' as const,
      content: normalizeMessageContent(msg.content),
    }));
}

/**
 * Extract conversation history (remembered messages) from LLM span
 * Excludes system messages and the current input message
 */
function extractRememberedMessages(llmSpan: SpanRecord, currentInputContent: string): MastraDBMessage[] {
  const messages = (llmSpan.input?.messages || [])
    .filter((msg: any) => msg.role !== 'system')
    .filter((msg: any) => normalizeMessageContent(msg.content) !== currentInputContent);

  return messages.map((msg: any) => createMastraDBMessage(msg, llmSpan.startedAt));
}

/**
 * Reconstruct tool invocations from tool call spans
 */
function reconstructToolInvocations(spanTree: SpanTree, parentSpanId: string) {
  const toolSpans = getChildrenOfType<SpanRecord>(spanTree, parentSpanId, SpanType.TOOL_CALL);

  return toolSpans.map(toolSpan => ({
    toolCallId: toolSpan.spanId,
    toolName: toolSpan.attributes?.toolId || '',
    args: toolSpan.input || {},
    result: toolSpan.output || {},
    state: 'result' as const,
  }));
}

/**
 * Validate trace structure and throw descriptive errors
 */
export function validateTrace(trace: TraceRecord): void {
  if (!trace) {
    throw new Error('Trace is null or undefined');
  }

  if (!trace.spans || !Array.isArray(trace.spans)) {
    throw new Error('Trace must have a spans array');
  }

  if (trace.spans.length === 0) {
    throw new Error('Trace has no spans');
  }

  // Check for circular references in parent-child relationships
  const spanIds = new Set(trace.spans.map(span => span.spanId));
  for (const span of trace.spans) {
    if (span.parentSpanId && !spanIds.has(span.parentSpanId)) {
      throw new Error(`Span ${span.spanId} references non-existent parent ${span.parentSpanId}`);
    }
  }
}

/**
 * Find the most recent model span that contains conversation history
 */
function findPrimaryLLMSpan(spanTree: SpanTree, rootAgentSpan: SpanRecord): SpanRecord {
  const directLLMSpans = getChildrenOfType<SpanRecord>(spanTree, rootAgentSpan.spanId, SpanType.MODEL_GENERATION);
  if (directLLMSpans.length > 0) {
    // There should only be one model generation span per agent run which is a direct child of the root agent span
    return directLLMSpans[0]!;
  }

  throw new Error('No model generation span found in trace');
}

/**
 * Extract common trace validation and span tree building logic
 */
function prepareTraceForTransformation(trace: TraceRecord) {
  validateTrace(trace);
  const spanTree = buildSpanTree(trace.spans);

  // Find the root agent run span
  const rootAgentSpan = spanTree.rootSpans.find(span => span.spanType === 'agent_run') as SpanRecord | undefined;

  if (!rootAgentSpan) {
    throw new Error('No root agent_run span found in trace');
  }

  return { spanTree, rootAgentSpan };
}

export function transformTraceToScorerInputAndOutput(trace: TraceRecord): {
  input: ScorerRunInputForAgent;
  output: ScorerRunOutputForAgent;
} {
  const { spanTree, rootAgentSpan } = prepareTraceForTransformation(trace);

  if (!rootAgentSpan.output) {
    throw new Error('Root agent span has no output');
  }

  // Build input
  const primaryLLMSpan = findPrimaryLLMSpan(spanTree, rootAgentSpan);
  const inputMessages = extractInputMessages(rootAgentSpan);
  const systemMessages = extractSystemMessages(primaryLLMSpan);

  // Extract remembered messages from LLM span (excluding current input)
  const currentInputContent = inputMessages[0]?.content.content || '';
  const rememberedMessages = extractRememberedMessages(primaryLLMSpan, currentInputContent);

  const input = {
    inputMessages,
    rememberedMessages,
    systemMessages,
    taggedSystemMessages: {}, // Todo: Support tagged system messages
  };

  // Build output
  const toolInvocations = reconstructToolInvocations(spanTree, rootAgentSpan.spanId);
  const responseText = rootAgentSpan.output.text || '';

  // Build parts array: tool invocations first, then text
  const parts: Array<{ type: 'tool-invocation'; toolInvocation: any } | { type: 'text'; text: string }> = [];

  // Add tool invocation parts
  for (const toolInvocation of toolInvocations) {
    parts.push({
      type: 'tool-invocation',
      toolInvocation,
    });
  }

  // Add text part if present
  if (responseText.trim()) {
    parts.push({
      type: 'text',
      text: responseText,
    });
  }

  const responseMessage: MastraDBMessage = {
    id: '',
    role: 'assistant',
    content: {
      format: 2,
      parts: parts as any, // Type assertion needed due to providerMetadata optional field
      content: responseText,
      toolInvocations, // Always include, even if empty array
    },
    createdAt: new Date(rootAgentSpan.endedAt || rootAgentSpan.startedAt),
  };

  const output: MastraDBMessage[] = [responseMessage];

  return {
    input,
    output,
  };
}
