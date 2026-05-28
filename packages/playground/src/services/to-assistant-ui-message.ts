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
    return { type: 'text', text: part.text, metadata: getPartMetadata(message, part) };
  }

  if (part.type === 'reasoning') {
    return { type: 'reasoning', text: part.reasoning, metadata: getPartMetadata(message, part) } as ContentPart;
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
