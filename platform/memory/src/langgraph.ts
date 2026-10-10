import { ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { createMiddleware } from 'langchain';

import { PlatformMemoryClient } from './client';
import type { PlatformMemoryClientOptions } from './client';
import { fromMemory, toParts } from './langchain';
import { promptOf } from './parts';
import { createTurnMemory } from './turn';
import type { TurnItem } from './turn';

export type PlatformMemoryAgentMiddlewareOptions = PlatformMemoryClientOptions & {
  /** Defaults to the run's `configurable.thread_id`. */
  threadId?: string;
  /** Who the memory belongs to. Defaults to the thread id. */
  resourceId?: string;
  /** Read memory without saving turns. */
  readOnly?: boolean;
  client?: PlatformMemoryClient;
};

function toItems(messages: BaseMessage[]): TurnItem[] {
  return messages.flatMap((m): TurnItem[] => {
    const type = m.getType();
    if (type === 'human') return [{ role: 'user', parts: toParts(m) }];
    if (type === 'ai') return [{ role: 'assistant', parts: toParts(m) }];
    if (type === 'tool' && ToolMessage.isInstance(m)) {
      return [{ role: 'tool', results: [{ toolCallId: m.tool_call_id, result: m.text }] }];
    }
    return [];
  });
}

/**
 * LangChain `createAgent` middleware (LangGraph runtime) for Platform Memory: each model call
 * sees memory's context plus the current turn, and turns are saved as they run, including mid
 * tool loop, so long loops are observed and compressed mid-turn like @mastra/memory does.
 * The graph state keeps the full transcript; only the prompt sent to the model is rewritten.
 */
export function platformMemoryAgentMiddleware(options: PlatformMemoryAgentMiddlewareOptions = {}) {
  const client = options.client ?? new PlatformMemoryClient(options);
  const turns = createTurnMemory(client, options.readOnly);

  type Runtime = { configurable?: { thread_id?: string; ls_agent_type?: string } };
  // Deep Agents subagents inherit the parent's thread_id; their internal loops are not the user's conversation.
  const isSubagent = (runtime: Runtime) => runtime.configurable?.ls_agent_type === 'subagent';

  const idsOf = (runtime: Runtime) => {
    const threadId = options.threadId ?? runtime.configurable?.thread_id;
    if (!threadId) throw new Error('Platform Memory needs a threadId option or configurable.thread_id');
    return { threadId, resourceId: options.resourceId ?? threadId };
  };

  return createMiddleware({
    name: 'PlatformMemory',

    async wrapModelCall(request, handler) {
      if (isSubagent(request.runtime)) return handler(request);
      const { threadId, resourceId } = idsOf(request.runtime);
      // Graph state holds the raw transcript; outer middleware (e.g. Deep Agents summarization) may have rewritten request.messages.
      const messages = (request.state as { messages?: BaseMessage[] }).messages ?? request.messages;
      const saved = await turns.beforeStep(threadId, resourceId, toItems(messages));
      const context = await client.getContext(threadId, resourceId);
      // The current turn: the last run of human messages and everything after. Earlier turns come from memory.
      let first = messages.findLastIndex(m => m.getType() === 'human');
      while (first > 0 && messages[first - 1]!.getType() === 'human') first--;
      const turn = saved || first < 0 ? [] : messages.slice(first);
      return handler({ ...request, messages: [...promptOf(context).flatMap(fromMemory), ...turn] });
    },

    async afterAgent(state, runtime) {
      if (isSubagent(runtime)) return;
      const { threadId, resourceId } = idsOf(runtime);
      await turns.save(threadId, resourceId, toItems(state.messages));
    },
  });
}
