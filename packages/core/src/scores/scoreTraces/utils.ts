import type { ToolInvocation } from 'ai';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../types';
import type { UIMessageWithMetadata } from '../../agent';
import { AISpanType } from '../../ai-tracing';
import type { AISpanRecord, AITraceRecord } from '../../storage';

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
  // For array format, extract text from text parts
  return content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('');
}

/**
 * Convert v5 message to v4 UIMessage format
 */
function convertToUIMessage(
  message: { role: string; content: string | Array<{ type: string; text: string }> },
  createdAt: Date,
): UIMessageWithMetadata {
  const content = normalizeMessageContent(message.content);

  return {
    id: '',
    role: message.role as 'user' | 'assistant' | 'system',
    content,
    createdAt: new Date(createdAt),
    parts: [
      {
        type: 'text',
        text: content,
      },
    ],
    experimental_attachments: [],
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
  // First try direct children of root agent
  const directLLMSpans = getChildrenOfType<AISpanRecord>(spanTree, rootAgentSpan.spanId, AISpanType.LLM_GENERATION);

  if (directLLMSpans.length > 0) {
    return directLLMSpans[directLLMSpans.length - 1]!; // Take the last (most recent) one
  }

  // If no direct children, search in sub-agent spans
  const subAgentSpans = getChildrenOfType<AISpanRecord>(spanTree, rootAgentSpan.spanId, AISpanType.AGENT_RUN);

  for (const subAgent of subAgentSpans) {
    const subLLMSpans = getChildrenOfType<AISpanRecord>(spanTree, subAgent.spanId, AISpanType.LLM_GENERATION);
    if (subLLMSpans.length > 0) {
      return subLLMSpans[subLLMSpans.length - 1]!;
    }
  }

  throw new Error('No LLM generation span found in trace');
}

/**
 * Transform trace to scorer input format
 */
export function transformTraceToScorerInput(trace: AITraceRecord): ScorerRunInputForAgent {
  try {
    validateTrace(trace);
    const spanTree = buildSpanTree(trace.spans);

    // Find the root agent run span
    const rootAgentSpan = spanTree.rootSpans.find(span => span.spanType === 'agent_run') as AISpanRecord | undefined;

    if (!rootAgentSpan) {
      throw new Error('No root agent_run span found in trace');
    }

    // Find the primary LLM generation span
    const primaryLLMSpan = findPrimaryLLMSpan(spanTree, rootAgentSpan);

    // Extract input messages from agent span
    const inputMessages = extractInputMessages(rootAgentSpan);

    // Extract system messages from LLM span
    const systemMessages = extractSystemMessages(primaryLLMSpan);

    // Extract remembered messages from LLM span (excluding current input)
    const currentInputContent = inputMessages[0]?.content || '';
    const rememberedMessages = extractRememberedMessages(primaryLLMSpan, currentInputContent);

    return {
      // We do not keep track of the tool call ids in traces, so we need to cast to UIMessageWithMetadata
      inputMessages: inputMessages as UIMessageWithMetadata[],
      rememberedMessages: rememberedMessages as UIMessageWithMetadata[],
      systemMessages,
      taggedSystemMessages: {}, // Not available in traces
    };
  } catch (error) {
    throw new Error(
      `Failed to transform trace to scorer input: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Transform trace to scorer output format
 */
export function transformTraceToScorerOutput(trace: AITraceRecord): ScorerRunOutputForAgent {
  try {
    validateTrace(trace);
    const spanTree = buildSpanTree(trace.spans);

    const rootAgentSpan = spanTree.rootSpans.find(span => span.spanType === 'agent_run') as AISpanRecord | undefined;

    if (!rootAgentSpan) {
      throw new Error('No root agent_run span found in trace');
    }

    if (!rootAgentSpan.output) {
      throw new Error('Root agent span has no output');
    }

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
    return [responseMessage as UIMessageWithMetadata];
  } catch (error) {
    throw new Error(
      `Failed to transform trace to scorer output: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
