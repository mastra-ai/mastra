import type { Agent, AgentMessage } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, ToolResultMessage } from '@earendil-works/pi-ai';

import { PlatformMemoryClient } from './client';
import type { MemoryMessage, MemoryMessagePart, PlatformMemoryClientOptions } from './client';
import {
  filePart,
  partsOf,
  promptOf,
  reasoningOf,
  reasoningPart,
  textOfParts,
  textPart,
  toolInvocationsOf,
  toolPart,
} from './parts';
import { createTurnMemory } from './turn';
import type { TurnItem } from './turn';

export type PlatformMemoryPiOptions = PlatformMemoryClientOptions & {
  threadId: string;
  /** Who the memory belongs to. Defaults to `threadId`. */
  resourceId?: string;
  /** Read memory without saving turns. */
  readOnly?: boolean;
  client?: PlatformMemoryClient;
};

const textOf = (content: string | { type: string; text?: string }[]) =>
  typeof content === 'string' ? content : content.flatMap(c => (c.type === 'text' && c.text ? [c.text] : [])).join('');

function toItems(messages: AgentMessage[]): TurnItem[] {
  return messages.flatMap((m): TurnItem[] => {
    if (!('role' in m)) return [];
    if (m.role === 'user') {
      if (typeof m.content === 'string') return [{ role: 'user', parts: [textPart(m.content)] }];
      const parts = m.content.map(c => (c.type === 'text' ? textPart(c.text) : filePart(c.data, c.mimeType)));
      return [{ role: 'user', parts }];
    }
    if (m.role === 'assistant') {
      const parts = m.content.flatMap((c): MemoryMessagePart[] => {
        if (c.type === 'text') return c.text ? [textPart(c.text)] : [];
        if (c.type === 'thinking') return c.thinking && !c.redacted ? [reasoningPart(c.thinking)] : [];
        return [toolPart({ toolCallId: c.id, toolName: c.name, args: c.arguments })];
      });
      return [{ role: 'assistant', parts }];
    }
    if (m.role === 'toolResult') {
      return [{ role: 'tool', results: [{ toolCallId: m.toolCallId, result: textOf(m.content) }] }];
    }
    return [];
  });
}

/** Replays a recalled message, including tool calls and their results, as pi messages. */
function fromMemory(message: MemoryMessage): AgentMessage[] {
  const timestamp = new Date(message.createdAt ?? 0).getTime();
  if (message.role === 'system') return [{ role: 'system', content: message.content, timestamp }];
  const parts = partsOf(message);
  if (message.role !== 'assistant') return [{ role: 'user', content: textOfParts(parts), timestamp }];

  // A tool call is only valid in history alongside its result.
  const results = toolInvocationsOf(parts).filter(t => t.state === 'result');
  const reasoning = reasoningOf(parts);
  const assistant: AssistantMessage = {
    role: 'assistant',
    content: [
      ...(reasoning ? [{ type: 'thinking' as const, thinking: reasoning }] : []),
      ...(textOfParts(parts) ? [{ type: 'text' as const, text: textOfParts(parts) }] : []),
      ...results.map(t => ({
        type: 'toolCall' as const,
        id: t.toolCallId,
        name: t.toolName,
        arguments: (t.args ?? {}) as Record<string, never>,
      })),
    ],
    api: 'memory',
    provider: 'memory',
    model: 'memory',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: results.length ? 'toolUse' : 'stop',
    timestamp,
  };
  const toolResults: ToolResultMessage[] = results.map(t => ({
    role: 'toolResult',
    toolCallId: t.toolCallId,
    toolName: t.toolName,
    content: [{ type: 'text', text: typeof t.result === 'string' ? t.result : JSON.stringify(t.result ?? null) }],
    isError: false,
    timestamp,
  }));
  return [assistant, ...toolResults];
}

/**
 * Gives a pi `Agent` Platform Memory: before every model call the transcript is replaced by
 * memory's context plus the current turn, and turns are saved as they run, including mid
 * tool loop, so long loops are observed and compressed mid-turn. Returns an unsubscribe.
 */
export function withPlatformMemory(agent: Agent, options: PlatformMemoryPiOptions): () => void {
  const client = options.client ?? new PlatformMemoryClient(options);
  const { threadId, readOnly } = options;
  const resourceId = options.resourceId ?? threadId;
  const turns = createTurnMemory(client, readOnly);
  const previous = agent.transformContext;

  agent.transformContext = async (input, signal) => {
    const messages = previous ? await previous(input, signal) : input;
    const lead = messages[0] && 'role' in messages[0] && messages[0].role === 'system' ? [messages[0]] : [];
    const items = messages.slice(lead.length);
    const saved = await turns.beforeStep(threadId, resourceId, toItems(items));
    const context = await client.getContext(threadId, resourceId);
    // The current turn: the last run of user messages and everything after. Earlier turns come from memory.
    let first = items.findLastIndex(m => 'role' in m && m.role === 'user');
    while (first > 0 && 'role' in items[first - 1]! && items[first - 1]!.role === 'user') first--;
    const turn = saved || first < 0 ? [] : items.slice(first);
    return [...lead, ...promptOf(context).flatMap(fromMemory), ...turn];
  };

  const unsubscribe = agent.subscribe(async event => {
    if (event.type === 'agent_end') await turns.save(threadId, resourceId, toItems(event.messages));
  });

  return () => {
    unsubscribe();
    agent.transformContext = previous;
  };
}
