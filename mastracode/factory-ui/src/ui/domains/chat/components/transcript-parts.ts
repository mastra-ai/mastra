import { groupConsecutive, isTaskTool } from '@mastra/playground-ui/components/ai/tool-call';
import type { ConsecutiveGroups } from '@mastra/playground-ui/components/ai/tool-call';
import type { ToolInvocationPart } from '@mastra/react/ui';

import { isTerminalInvocationState } from '../services/transcript';
import type { MessageEntry, SuspensionPrompt, ToolCall } from '../services/transcript';

export type MessagePart = MessageEntry['message']['content']['parts'][number];
export type ToolPart = Extract<MessagePart, { type: 'tool-invocation' }>;

/** A message's prose as the one stream it was written as — the copyable answer. */
export function messageText(parts: MessagePart[]): string {
  return parts
    .flatMap(part => (part.type === 'text' ? [part.text] : []))
    .join('\n\n')
    .trim();
}

/** Terminal status carried by the persisted part, if it reached one. */
export function terminalInvocationStatus(
  invocation: ToolInvocationPart['toolInvocation'],
): 'done' | 'error' | undefined {
  if (!isTerminalInvocationState(invocation.state)) return undefined;
  if (invocation.state !== 'result') return 'error';
  return 'isError' in invocation && invocation.isError === true ? 'error' : 'done';
}

/** The parts holding a place in a reply: only kinds never drawn at all fall out. */
export function renderableParts(entry: MessageEntry): MessagePart[] {
  return mergeProse((entry.message.content.parts ?? []).filter(keepsSlot));
}

/**
 * One answer is one document, however many parts it was streamed in. A model's
 * text arrives as content blocks and a boundary can fall anywhere — mid-list,
 * mid-emphasis — so a part is a slice of the stream, not a passage: rendering
 * each on its own parses half a construct, and paces its own reveal, so a single
 * reply streams in three places at once. Joined as the stream sent it, with
 * nothing between.
 */
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

/**
 * Whether a part holds a place in the reply — decided from what it is, never from
 * what it currently holds. Content is mutable: prose fills in, reasoning lands whole,
 * a prompt arrives. A slot that came and went with its content would shift every part
 * after it, remounting text the reader is looking at and pulling the reveal's cursor
 * back through words already on screen. An empty slot renders nothing and waits.
 */
function keepsSlot(part: MessagePart): boolean {
  switch (part.type) {
    case 'text':
    case 'reasoning':
    case 'file':
      return true;
    case 'tool-invocation':
      return !isTaskTool(part.toolInvocation.toolName);
    default:
      return false;
  }
}

/** Whether a part puts anything on screen right now. */
export function draws(
  part: MessagePart,
  suspensions: ReadonlyMap<string, SuspensionPrompt>,
  runtimeTools: MessageEntry['runtimeTools'],
): boolean {
  switch (part.type) {
    case 'text':
      return part.text.trim().length > 0;
    case 'reasoning':
      return part.reasoning.trim().length > 0;
    case 'tool-invocation':
      return !isTaskTool(part.toolInvocation.toolName) && !awaitsPrompt(part, suspensions, runtimeTools);
    case 'file':
      return true;
    default:
      return false;
  }
}

/**
 * An `ask_user` still waiting for its suspension prompt draws nothing yet — but it
 * keeps its place in the parts list. Dropping it and inserting it back when the
 * prompt lands would shift every part after it, remounting text the reader is
 * looking at; a slot that renders nothing until it can render the prompt shifts none.
 */
function awaitsPrompt(
  part: ToolInvocationPart,
  suspensions: ReadonlyMap<string, SuspensionPrompt>,
  runtimeTools: MessageEntry['runtimeTools'],
): boolean {
  const tool = toolFromInvocationPart(part, runtimeTools?.[part.toolInvocation.toolCallId]);
  return tool.toolName === 'ask_user' && tool.status === 'running' && !suspensions.has(tool.toolCallId);
}

/** Tools whose own card carries the turn: a group row would swallow the prompt, the plan or the skill instructions. */
const UNGROUPABLE_TOOLS = new Set(['ask_user', 'submit_plan', 'skill']);

/**
 * Collapse runs of consecutive plain tool calls into groups keyed by their first
 * toolCallId. A suspended call breaks a run too: its prompt must render inline.
 */
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

/**
 * Builds the row model for a tool call. `messageCreatedAt` is the containing message's
 * timestamp, the fallback clock for parts core never stamped (live turns, older history).
 */
export function toolFromInvocationPart(
  part: ToolInvocationPart,
  runtime?: ToolCall,
  messageCreatedAt?: Date | string,
): ToolCall {
  const invocation = part.toolInvocation;
  // Thread history arrives as JSON, so the typed Date is an ISO string at runtime.
  const parsedCreatedAt = messageCreatedAt === undefined ? undefined : new Date(messageCreatedAt).getTime();
  const fallbackCreatedAt = Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : undefined;
  const persistedResult = 'result' in invocation ? invocation.result : undefined;
  // Persisted terminal state beats the live overlay: `tool_end` can be lost in
  // an SSE gap (no server replay), and a terminal part never regresses — the
  // overlay's 'running' would otherwise spin forever.
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
