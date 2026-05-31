import type { ThreadMessageLike, MessageStatus } from '@assistant-ui/react';
import type { MastraDBMessage, MastraMessagePart, MastraToolInvocationPart } from '@mastra/core/agent/message-list';
import type { ReadonlyJSONObject } from '@mastra/core/stream';

/**
 * Local AI-SDK -> assistant-ui converter for the playground.
 *
 * Accepts a `MastraDBMessage` (the shape `useChat` returns) and maps it to an
 * assistant-ui `ThreadMessageLike`. Tool-call state is preserved via
 * `tool-invocation` parts, and DB-level message metadata is forwarded onto each
 * content part so downstream renderers (tool badges, error-aware text) can
 * read `mode`, `status`, `tripwire`, etc. without a second adapter pass.
 */

type ContentPart = { metadata?: Record<string, unknown> } & (Exclude<
  ThreadMessageLike['content'],
  string
> extends readonly (infer T)[]
  ? T
  : never);

const getPartMetadata = (message: MastraDBMessage, part: MastraMessagePart) => ({
  ...message.content.metadata,
  ...('providerMetadata' in part && part.providerMetadata ? { providerMetadata: part.providerMetadata } : {}),
});

const getToolArgs = (toolInvocation: MastraToolInvocationPart['toolInvocation']) => {
  const invocation = toolInvocation as MastraToolInvocationPart['toolInvocation'] & {
    args?: unknown;
    rawInput?: unknown;
  };
  return invocation.args ?? invocation.rawInput ?? {};
};

/**
 * Render-time reconstruction for persisted network routing decisions.
 *
 * Network runs persist their routing decision as a plain assistant text part
 * containing a JSON blob like `{ "isNetwork": true, ... }`. During streaming the
 * accumulator builds a `dynamic-tool` part (with `childMessages`, network
 * metadata, etc.) that renders the nested agent/tool/workflow badge. The server
 * does not persist that part, so on reload only the raw routing JSON survives.
 *
 * To make reload render identically to streaming, we transform the persisted
 * routing JSON back into the same `tool-call` shape the `dynamic-tool` branch
 * produces. This mirrors `main`'s `resolveInitialMessages` reconstruction.
 *
 * Network mode is being deprecated soon, so this lives at render time in the
 * playground converter rather than as a separate rehydration layer.
 */
interface NetworkToolCallContent {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
}

interface NetworkToolResultContent {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result?: { result?: { steps?: unknown } & Record<string, unknown> } & Record<string, unknown>;
}

interface NetworkNestedMessage {
  type?: string;
  content?: string | (NetworkToolCallContent | NetworkToolResultContent)[];
}

interface NetworkFinalResult {
  result?: unknown;
  text?: string;
  messages?: NetworkNestedMessage[];
}

interface NetworkRoutingDecision {
  isNetwork: true;
  selectionReason?: string;
  primitiveType?: string;
  primitiveId?: string;
  input?: unknown;
  finalResult?: NetworkFinalResult;
}

interface NetworkChildMessage {
  type: 'tool' | 'text';
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  toolOutput?: unknown;
  content?: string;
}

const parseNetworkRoutingDecision = (text: string): NetworkRoutingDecision | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null && (parsed as { isNetwork?: unknown }).isNetwork === true) {
      return parsed as NetworkRoutingDecision;
    }
    return null;
  } catch {
    return null;
  }
};

const buildNetworkChildMessages = (finalResult: NetworkFinalResult | undefined): NetworkChildMessage[] => {
  const messages = finalResult?.messages ?? [];
  const childMessages: NetworkChildMessage[] = [];

  const toolResultMap = new Map<string, NetworkToolResultContent>();
  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'tool-result') {
          toolResultMap.set(part.toolCallId, part);
        }
      }
    }
  }

  for (const msg of messages) {
    if (msg.type === 'tool-call' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'tool-call') {
          const toolResult = toolResultMap.get(part.toolCallId);
          const isWorkflow = Boolean(toolResult?.result?.result?.steps);
          childMessages.push({
            type: 'tool',
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            args: part.args,
            toolOutput: isWorkflow ? toolResult?.result?.result : toolResult?.result,
          });
        }
      }
    }
  }

  if (finalResult?.text) {
    childMessages.push({ type: 'text', content: finalResult.text });
  }

  return childMessages;
};

const networkFromForPrimitive = (primitiveType: string | undefined): 'AGENT' | 'TOOL' | 'WORKFLOW' =>
  primitiveType === 'tool' ? 'TOOL' : primitiveType === 'workflow' ? 'WORKFLOW' : 'AGENT';

const toNetworkToolCallContent = (message: MastraDBMessage, decision: NetworkRoutingDecision): ContentPart => {
  const primitiveId = decision.primitiveId ?? '';
  const finalResult = decision.finalResult;
  const result =
    decision.primitiveType === 'tool'
      ? finalResult?.result
      : { childMessages: buildNetworkChildMessages(finalResult), result: finalResult?.text ?? '' };

  return {
    type: 'tool-call',
    toolCallId: primitiveId,
    toolName: primitiveId,
    argsText: JSON.stringify(decision.input),
    args: (decision.input ?? {}) as ReadonlyJSONObject,
    result,
    metadata: {
      ...message.content.metadata,
      mode: 'network',
      selectionReason: decision.selectionReason ?? '',
      agentInput: decision.input,
      from: networkFromForPrimitive(decision.primitiveType),
    },
  };
};

const toToolCallContent = (message: MastraDBMessage, part: MastraToolInvocationPart): ContentPart => {
  const { toolInvocation } = part;
  const args = getToolArgs(toolInvocation) as ReadonlyJSONObject;
  const baseToolCall: ContentPart = {
    type: 'tool-call' as const,
    toolCallId: toolInvocation.toolCallId,
    toolName: toolInvocation.toolName,
    argsText: JSON.stringify(args),
    args,
    metadata: getPartMetadata(message, part),
  };

  if (toolInvocation.state === 'output-error') {
    return { ...baseToolCall, result: toolInvocation.errorText ?? toolInvocation.result, isError: true };
  }

  if (toolInvocation.state === 'output-denied') {
    return {
      ...baseToolCall,
      result: toolInvocation.approval?.reason ?? 'Tool call denied',
      isError: true,
    };
  }

  if ('result' in toolInvocation && toolInvocation.result !== undefined) {
    return { ...baseToolCall, result: toolInvocation.result };
  }

  return baseToolCall;
};

const toContentPart = (message: MastraDBMessage, part: MastraMessagePart): ContentPart => {
  if (part.type === 'text') {
    const networkDecision = parseNetworkRoutingDecision(part.text);
    if (networkDecision) {
      return toNetworkToolCallContent(message, networkDecision);
    }
    return { type: 'text', text: part.text, metadata: getPartMetadata(message, part) };
  }

  if (part.type === 'reasoning') {
    // Persisted reasoning parts arrive with an empty `reasoning` string and the
    // text in `details` (AIV5Adapter writes `reasoning: '', details: [...]`), so
    // fall back to the joined `details` text on reload, mirroring core's reader.
    const text =
      part.reasoning || (part.details ?? []).map(detail => (detail.type === 'text' ? detail.text : '')).join('');
    return { type: 'reasoning', text, metadata: getPartMetadata(message, part) } as ContentPart;
  }

  if (part.type === 'source') {
    return {
      type: 'source',
      sourceType: 'url',
      id: part.source.id,
      url: part.source.url,
      title: part.source.title,
      metadata: getPartMetadata(message, part),
    } as ContentPart;
  }

  if (part.type === 'source-document') {
    return {
      type: 'file',
      filename: part.filename ?? part.title,
      mimeType: part.mediaType,
      data: '',
      metadata: getPartMetadata(message, part),
    };
  }

  if (part.type === 'file') {
    if (part.mimeType?.includes('image/')) {
      return { type: 'image', image: part.data, metadata: getPartMetadata(message, part) } as ContentPart;
    }

    return {
      type: 'file',
      mimeType: part.mimeType,
      data: part.data,
      metadata: getPartMetadata(message, part),
    } as ContentPart;
  }

  if (part.type === 'tool-invocation') {
    return toToolCallContent(message, part);
  }

  if ((part.type as string) === 'dynamic-tool') {
    const dynamicPart = part as unknown as {
      toolCallId: string;
      toolName: string;
      input: unknown;
      output?: unknown;
      state?: string;
      errorText?: string;
    };

    const baseToolCall: ContentPart = {
      type: 'tool-call' as const,
      toolCallId: dynamicPart.toolCallId,
      toolName: dynamicPart.toolName,
      argsText: JSON.stringify(dynamicPart.input),
      args: dynamicPart.input as ReadonlyJSONObject,
      metadata: getPartMetadata(message, part),
    };

    if (dynamicPart.state === 'output-error' && dynamicPart.errorText !== undefined) {
      return { ...baseToolCall, result: dynamicPart.errorText, isError: true };
    }

    if (dynamicPart.output !== undefined) {
      return { ...baseToolCall, result: dynamicPart.output };
    }

    return baseToolCall;
  }

  if (part.type.startsWith('data-')) {
    return {
      type: 'data',
      name: part.type.substring(5),
      data: 'data' in part ? part.data : undefined,
      metadata: getPartMetadata(message, part),
    } as ContentPart;
  }

  return { type: 'text', text: '', metadata: getPartMetadata(message, part) };
};

const toStatus = (message: MastraDBMessage): MessageStatus | undefined => {
  if (message.role !== 'assistant' || message.content.parts.length === 0) return undefined;

  const hasStreamingText = message.content.parts.some(
    part => (part.type === 'text' || part.type === 'reasoning') && 'state' in part && part.state === 'streaming',
  );
  if (hasStreamingText) return { type: 'running' };

  const hasApprovalTool = message.content.parts.some(
    part => part.type === 'tool-invocation' && part.toolInvocation.state === 'approval-requested',
  );
  if (hasApprovalTool) return { type: 'requires-action', reason: 'tool-calls' };

  const hasErrorTool = message.content.parts.some(
    part =>
      part.type === 'tool-invocation' &&
      (part.toolInvocation.state === 'output-error' || part.toolInvocation.state === 'output-denied'),
  );
  if (hasErrorTool) return { type: 'incomplete', reason: 'error' };

  return { type: 'complete', reason: 'stop' };
};

export const toAssistantUIMessage = (message: MastraDBMessage): ThreadMessageLike =>
  ({
    id: message.id,
    role: message.role === 'signal' ? 'system' : message.role,
    content: message.content.parts.map(part => toContentPart(message, part)),
    status: toStatus(message),
    createdAt: message.createdAt,
    metadata: {
      ...message.content.metadata,
      threadId: message.threadId,
      resourceId: message.resourceId,
      createdAt: message.createdAt,
    } as ThreadMessageLike['metadata'],
  }) as ThreadMessageLike;
