import type { ToolInvocation } from 'ai';
import type { UIMessageWithMetadata } from '../../agent';
import { convertMessages } from '../../agent/message-list/utils/convert-messages';
import { AISpanType } from '../../ai-tracing';
import type { AISpanRecord, AITraceRecord } from '../../storage';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../types';

// // Span tree structure for efficient lookups
interface SpanTree {
  spanMap: Map<string, AISpanRecord>;
  childrenMap: Map<string, AISpanRecord[]>;
  rootSpans: AISpanRecord[];
}

// Spans don't have ids, so we need to omit it from the UIMessageWithMetadata type
type TransformedUIMessage = Omit<UIMessageWithMetadata, 'id'>;

/**
 * Build a hierarchical span tree with efficient lookup maps
 */
export function buildSpanTree(spans: AISpanRecord[]): SpanTree {
  const spanMap = new Map<string, AISpanRecord>();
  const childrenMap = new Map<string, AISpanRecord[]>();
  const rootSpans: AISpanRecord[] = [];

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
function getChildrenOfType<T extends AISpanRecord>(
  spanTree: SpanTree,
  parentSpanId: string,
  spanType: AISpanType,
): T[] {
  const children = spanTree.childrenMap.get(parentSpanId) || [];
  return children.filter(span => span.spanType === spanType) as T[];
}

/**
 * Convert AI SDK v5 message content to v4 format
 */
function normalizeMessageContent(content: string | Array<{ type: string; text: string }>): string {
  if (typeof content === 'string') {
    return content;
  }

  const tempMessage = {
    id: 'temp',
    role: 'user' as const,
    parts: content.map(part => ({ type: part.type as 'text', text: part.text })),
  };

  const converted = convertMessages(tempMessage).to('AIV4.UI');
  return converted[0]?.content || '';
}

/**
 * Convert v5 message to v4 UIMessage format using convertMessages
 * Ensures full consistency with AI SDK UIMessage behavior
 */
function convertToUIMessage(
  message: { role: string; content: string | Array<{ type: string; text: string }> },
  createdAt: Date,
): UIMessageWithMetadata {
  // Create proper message input for convertMessages
  let messageInput;
  if (typeof message.content === 'string') {
    messageInput = {
      id: 'temp',
      role: message.role as 'user' | 'assistant' | 'system',
      content: message.content,
    };
  } else {
    messageInput = {
      id: 'temp',
      role: message.role as 'user' | 'assistant' | 'system',
      parts: message.content.map(part => ({ type: part.type as 'text', text: part.text })),
    };
  }

  const converted = convertMessages(messageInput).to('AIV4.UI');
  const result = converted[0];

  if (!result) {
    throw new Error('Failed to convert message');
  }

  return {
    ...result,
    id: '', // Spans don't have message IDs
    createdAt: new Date(createdAt), // Use span timestamp
  };
}

/**
 * Extract input messages from agent run span
 */
function extractInputMessages(agentSpan: AISpanRecord): TransformedUIMessage[] {
  const input = agentSpan.input;

  // Handle different input formats
  if (typeof input === 'string') {
    return [
      {
        role: 'user',
        content: input,
        createdAt: new Date(agentSpan.startedAt),
        parts: [{ type: 'text', text: input }],
        experimental_attachments: [],
      },
    ];
  }

  if (Array.isArray(input)) {
    return input.map(msg => convertToUIMessage(msg, agentSpan.startedAt));
  }

  // @ts-ignore
  if (input && typeof input === 'object' && Array.isArray(input.messages)) {
    // @ts-ignore
    return input.messages.map(msg => convertToUIMessage(msg, agentSpan.startedAt));
  }
  return [];
}

/**
 * Extract system messages from LLM span
 */
function extractSystemMessages(llmSpan: AISpanRecord): Array<{ role: 'system'; content: string }> {
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
function extractRememberedMessages(llmSpan: AISpanRecord, currentInputContent: string): TransformedUIMessage[] {
  const messages = (llmSpan.input?.messages || [])
    .filter((msg: any) => msg.role !== 'system')
    .filter((msg: any) => normalizeMessageContent(msg.content) !== currentInputContent);

  return messages.map((msg: any) => convertToUIMessage(msg, llmSpan.startedAt));
}

/**
 * Reconstruct tool invocations from tool call spans
 */
function reconstructToolInvocations(spanTree: SpanTree, parentSpanId: string) {
  const toolSpans = getChildrenOfType<AISpanRecord>(spanTree, parentSpanId, AISpanType.TOOL_CALL);

  return toolSpans.map(toolSpan => ({
    state: 'result' as const,
    toolName: toolSpan.attributes?.toolId,
    args: toolSpan.input || {},
    result: toolSpan.output || {},
  }));
}

/**
 * Create message parts array including tool invocations and text
 */
function createMessageParts(toolInvocations: AISpanRecord[], textContent: string) {
  const parts: { type: 'tool-invocation' | 'text'; toolInvocation?: AISpanRecord; text?: string }[] = [];
  for (const toolInvocation of toolInvocations) {
    parts.push({
      type: 'tool-invocation',
      toolInvocation,
    });
  }

  if (textContent.trim()) {
    parts.push({
      type: 'text',
      text: textContent,
    });
  }

  return parts;
}

/**
 * Validate trace structure and throw descriptive errors
 */
export function validateTrace(trace: AITraceRecord): void {
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
 * Find the most recent LLM span that contains conversation history
 */
function findPrimaryLLMSpan(spanTree: SpanTree, rootAgentSpan: AISpanRecord): AISpanRecord {
  const directLLMSpans = getChildrenOfType<AISpanRecord>(spanTree, rootAgentSpan.spanId, AISpanType.LLM_GENERATION);
  if (directLLMSpans.length > 0) {
    // There should only be one LLM generation span per agent run which is a direct child of the root agent span
    return directLLMSpans[0]!;
  }

  throw new Error('No LLM generation span found in trace');
}

/**
 * Extract common trace validation and span tree building logic
 */
function prepareTraceForTransformation(trace: AITraceRecord) {
  validateTrace(trace);
  const spanTree = buildSpanTree(trace.spans);

  // Find the root agent run span
  const rootAgentSpan = spanTree.rootSpans.find(span => span.spanType === 'agent_run') as AISpanRecord | undefined;

  if (!rootAgentSpan) {
    throw new Error('No root agent_run span found in trace');
  }

  return { spanTree, rootAgentSpan };
}

export function transformTraceToScorerInputAndOutput(trace: AITraceRecord): {
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
  const currentInputContent = inputMessages[0]?.content || '';
  const rememberedMessages = extractRememberedMessages(primaryLLMSpan, currentInputContent);

  const input = {
    // We do not keep track of the tool call ids in traces, so we need to cast to UIMessageWithMetadata
    inputMessages: inputMessages as UIMessageWithMetadata[],
    rememberedMessages: rememberedMessages as UIMessageWithMetadata[],
    systemMessages,
    taggedSystemMessages: {}, // Todo: Support tagged system messages
  };

  // Build output
  const toolInvocations = reconstructToolInvocations(spanTree, rootAgentSpan.spanId);
  const responseText = rootAgentSpan.output.text || '';

  const responseMessage: TransformedUIMessage = {
    role: 'assistant',
    content: responseText,
    createdAt: new Date(rootAgentSpan.endedAt || rootAgentSpan.startedAt),
    // @ts-ignore
    parts: createMessageParts(toolInvocations, responseText),
    experimental_attachments: [],
    // Tool invocations are being deprecated however we need to support it for now
    toolInvocations: toolInvocations as unknown as ToolInvocation[],
  };

  // We do not keep track of the tool call ids in traces, so we need to cast to UIMessageWithMetadata
  const output = [responseMessage as UIMessageWithMetadata];

  return {
    input,
    output,
  };
}
