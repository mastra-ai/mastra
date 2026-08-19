import type { MastraDBMessage } from '@mastra/core/agent/message-list';

import { getAskUserSuspendPayload, isInlineToolCallHidden } from '../tools/tool-card-visibility';
import { getSignalType, isSignalData, isTaskSignalData, isUserSignalType, toReactiveSignalData } from './signal-data';

type MessagePart = MastraDBMessage['content']['parts'][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const getMessageDisplayRole = (message: MastraDBMessage): MastraDBMessage['role'] | null => {
  if (message.role === 'assistant' || message.role === 'user' || message.role === 'system') return message.role;
  if (message.role === 'signal') return isUserSignalType(getSignalType(message)) ? 'user' : 'assistant';
  return null;
};

const toReactiveSignalMessage = (message: MastraDBMessage): MastraDBMessage | null => {
  const data = toReactiveSignalData(message);
  if (!isSignalData(data)) return null;
  const parts: MastraDBMessage['content']['parts'] = [{ type: 'data-signal', data }];
  return {
    ...message,
    role: 'assistant',
    content: { ...message.content, parts },
  };
};

const toDisplayMessage = (message: MastraDBMessage): MastraDBMessage | null => {
  const displayRole = getMessageDisplayRole(message);
  if (displayRole === null) return null;
  if (message.role === 'signal' && displayRole === 'assistant') return toReactiveSignalMessage(message);
  if (displayRole === message.role) return message;
  return { ...message, role: displayRole };
};

export const getMessageMetadata = (message: MastraDBMessage): Record<string, unknown> | undefined =>
  isRecord(message.content.metadata) ? message.content.metadata : undefined;

export const getToolPartName = (part: { type: string }): string | undefined => {
  if (part.type === 'tool-invocation') {
    const toolName = readField(readField(part, 'toolInvocation'), 'toolName');
    return typeof toolName === 'string' ? toolName : undefined;
  }

  if (part.type === 'dynamic-tool' || (part.type.startsWith('tool-') && part.type !== 'tool-invocation')) {
    const toolName = readField(part, 'toolName');
    return typeof toolName === 'string' ? toolName : part.type.replace(/^tool-/, '');
  }

  return undefined;
};

const getToolPartCallId = (part: { type: string }): string | undefined => {
  const value =
    part.type === 'tool-invocation'
      ? readField(readField(part, 'toolInvocation'), 'toolCallId')
      : readField(part, 'toolCallId');
  return typeof value === 'string' ? value : undefined;
};

const isRenderableMessagePart = (part: MessagePart, metadata: Record<string, unknown> | undefined): boolean => {
  const toolName = getToolPartName(part);
  if (toolName !== undefined) {
    if (isInlineToolCallHidden(toolName)) return false;
    if (toolName !== 'ask_user') return true;

    const toolCallId = getToolPartCallId(part);
    return toolCallId !== undefined && getAskUserSuspendPayload(metadata, toolName, toolCallId) !== undefined;
  }

  if (part.type === 'text') {
    const value = readField(part, 'text');
    return typeof value === 'string' && value.trim().length > 0;
  }

  if (part.type === 'reasoning') {
    const value = readField(part, 'text') ?? readField(part, 'reasoning');
    return (
      (typeof value === 'string' && value.trim().length > 0) ||
      readField(part, 'redacted') === true ||
      readField(part, 'state') === 'streaming'
    );
  }

  if (part.type === 'file') return true;

  if (part.type === 'data-signal') {
    const data = readField(part, 'data');
    return isSignalData(data) && !isTaskSignalData(data);
  }

  return false;
};

const withRenderableParts = (message: MastraDBMessage): MastraDBMessage => {
  const metadata = getMessageMetadata(message);
  const parts = message.content.parts.filter(part => isRenderableMessagePart(part, metadata));
  if (parts.length === message.content.parts.length) return message;
  return { ...message, content: { ...message.content, parts } };
};

export const toRenderableMessage = (message: MastraDBMessage): MastraDBMessage | null => {
  const displayMessage = toDisplayMessage(message);
  if (displayMessage === null) return null;

  const renderableMessage = withRenderableParts(displayMessage);
  return renderableMessage.content.parts.length > 0 ? renderableMessage : null;
};
