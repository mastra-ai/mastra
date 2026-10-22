import { groupConsecutive, isTaskTool } from '@mastra/playground-ui/components/ai/tool-call';
import type { ConsecutiveGroups } from '@mastra/playground-ui/components/ai/tool-call';
import type { ToolInvocationPart } from '@mastra/react/ui';
import { getReasoningContent } from '@mastra/playground-ui/domains/chat/messages/reasoning-content';

import { isTerminalInvocationState } from '../services/transcript';
import type { MessageEntry, SuspensionPrompt, ToolCall } from '../services/transcript';
import { isRecord } from './transcript-shared';

export type MessagePart = MessageEntry['message']['content']['parts'][number];
export type ToolPart = Extract<MessagePart, { type: 'tool-invocation' }>;

/**
 * Whether text shows anything. Models told to end a turn with an empty message
 * often send a zero-width space, which `trim()` keeps.
 */
export function hasVisibleText(text: string): boolean {
  return /[^\s\u200B-\u200D\u2060\uFEFF]/.test(text);
}

export function messageText(parts: MessagePart[]): string {
  return parts
    .flatMap(part => (isRecord(part) && part.type === 'text' && hasVisibleText(part.text) ? [part.text] : []))
    .join('\n\n')
    .trim();
}

/**
 * What the agent posted to a chat thread with `reply_in_thread` in these parts.
 * On a run that hides reply text this, not the prose, is the reply people read.
 */
export function channelReplyText(parts: MessagePart[]): string {
  return parts
    .flatMap(part => {
      if (!isRecord(part) || part.type !== 'tool-invocation') return [];
      const call = part.toolInvocation;
      if (call.toolName !== 'reply_in_thread' || call.state !== 'result') return [];
      const args: unknown = call.args;
      return isRecord(args) && typeof args.text === 'string' ? [args.text] : [];
    })
    .join('\n\n')
    .trim();
}

export function terminalInvocationStatus(
  invocation: ToolInvocationPart['toolInvocation'],
): 'done' | 'error' | undefined {
  if (!isTerminalInvocationState(invocation.state)) return undefined;
  if (invocation.state !== 'result') return 'error';
  return 'isError' in invocation && invocation.isError === true ? 'error' : 'done';
}

export function renderableParts(entry: MessageEntry): MessagePart[] {
  return mergeProse((entry.message.content.parts ?? []).filter(part => isRecord(part) && keepsSlot(part)));
}

function mergeProse(parts: MessagePart[]): MessagePart[] {
  const merged: MessagePart[] = [];

  for (const part of parts) {
    const previous = merged.at(-1);
    if (part.type === 'text' && previous?.type === 'text') {
      merged[merged.length - 1] = { ...previous, text: previous.text + part.text };
      continue;
    }
    merged.push(part);
  }

  return merged;
}

function keepsSlot(part: MessagePart): boolean {
  switch (part.type) {
    case 'text':
    case 'reasoning':
    case 'file':
    case 'error':
      return true;
    case 'tool-invocation':
      return !isTaskTool(part.toolInvocation.toolName);
    default:
      return false;
  }
}

export function draws(
  part: MessagePart,
  suspensions: ReadonlyMap<string, SuspensionPrompt>,
  runtimeTools: MessageEntry['runtimeTools'],
): boolean {
  if (!isRecord(part)) return false;

  switch (part.type) {
    case 'text':
      return hasVisibleText(part.text);
    case 'reasoning':
      return getReasoningContent(part) !== undefined;
    case 'tool-invocation':
      return !isTaskTool(part.toolInvocation.toolName) && !awaitsPrompt(part, suspensions, runtimeTools);
    case 'file':
      return true;
    case 'error':
      return true;
    default:
      return false;
  }
}

function awaitsPrompt(
  part: ToolInvocationPart,
  suspensions: ReadonlyMap<string, SuspensionPrompt>,
  runtimeTools: MessageEntry['runtimeTools'],
): boolean {
  const tool = toolFromInvocationPart(part, runtimeTools?.[part.toolInvocation.toolCallId]);
  return tool.toolName === 'ask_user' && tool.status === 'running' && !suspensions.has(tool.toolCallId);
}

const UNGROUPABLE_TOOLS = new Set(['ask_user', 'submit_plan', 'skill']);

export function collectToolGroups(
  parts: readonly MessagePart[],
  suspensions: ReadonlyMap<string, SuspensionPrompt>,
): ConsecutiveGroups<ToolPart> {
  return groupConsecutive(parts, {
    key: part => part.toolInvocation.toolCallId,
    joins: (part): part is ToolPart =>
      part.type === 'tool-invocation' &&
      !UNGROUPABLE_TOOLS.has(part.toolInvocation.toolName) &&
      !suspensions.has(part.toolInvocation.toolCallId),
  });
}

export function toolFromInvocationPart(
  part: ToolInvocationPart,
  runtime?: ToolCall,
  messageCreatedAt?: Date | string,
): ToolCall {
  const invocation = part.toolInvocation;
  const parsedCreatedAt = messageCreatedAt === undefined ? undefined : new Date(messageCreatedAt).getTime();
  const fallbackCreatedAt = Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : undefined;
  const persistedResult = 'result' in invocation ? invocation.result : undefined;
  const terminalStatus = terminalInvocationStatus(invocation);
  const result = terminalStatus
    ? (persistedResult ?? invocation.errorText ?? runtime?.result)
    : (runtime?.result ?? persistedResult ?? invocation.errorText);
  return {
    toolCallId: invocation.toolCallId,
    toolName: invocation.toolName,
    argsText: runtime?.argsText ?? '',
    args: runtime?.args ?? ('args' in invocation ? invocation.args : undefined),
    status: terminalStatus ?? runtime?.status ?? 'running',
    result,
    output: runtime?.output ?? '',
    createdAt: part.createdAt ?? runtime?.createdAt ?? fallbackCreatedAt,
  };
}
