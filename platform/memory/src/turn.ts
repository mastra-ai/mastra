import type { PlatformMemoryClient, MemoryMessageInput, MemoryMessagePart } from './client';
import { attachToolResult, messageInput } from './parts';

/** A framework transcript message, normalized for saving. */
export type TurnItem =
  | { role: 'user'; parts: MemoryMessagePart[] }
  | { role: 'assistant'; parts: MemoryMessagePart[] }
  | { role: 'tool'; results: { toolCallId: string; result: unknown }[] };

/**
 * What this turn adds: the last run of user messages, then one assistant message holding
 * every tool-loop step (tool calls with their results) and the final reply.
 */
function turnMessages(
  items: TurnItem[],
  reply: MemoryMessagePart[],
  idOf: (key: string) => string,
  /** Index where unobserved steps start; earlier steps of this turn were already observed. */
  from: number,
): MemoryMessageInput[] {
  const last = items.findLastIndex(m => m.role === 'user');
  let first = last;
  while (first > 0 && items[first - 1]!.role === 'user') first--;

  const messages = (from ? [] : items.slice(first, last + 1)).map(m =>
    m.role === 'user' ? messageInput('user', m.parts) : null,
  );

  const assistant: MemoryMessagePart[] = [];
  for (const m of items.slice(Math.max(last + 1, from))) {
    if (m.role === 'assistant') assistant.push(...m.parts);
    if (m.role === 'tool') for (const r of m.results) attachToolResult(assistant, r.toolCallId, r.result);
  }
  assistant.push(...reply);
  messages.push(messageInput('assistant', assistant));
  // Stable ids so a turn saved mid-loop is updated, not duplicated, by later saves.
  return messages
    .filter(m => m !== null)
    .map((m, i, all) => ({ ...m, id: idOf(i === all.length - 1 && m.role === 'assistant' ? 'a' : `u${i}`) }));
}

/**
 * Saves turns from a framework's agent loop, including mid tool loop, and observes mid-turn
 * once the thread crosses the observation threshold, like @mastra/memory does.
 */
export function createTurnMemory(client: PlatformMemoryClient, readOnly = false) {
  // Turn in flight per thread. After a mid-turn observation, later steps go into a new assistant
  // message so re-saving doesn't pull already-observed steps back into the unobserved tail.
  const turns = new Map<string, { key: string; base: string; from: number; seq: number }>();

  function currentTurn(threadId: string, items: TurnItem[]) {
    const key = JSON.stringify(items.findLast(m => m.role === 'user') ?? null);
    let turn = turns.get(threadId);
    if (turn?.key !== key) turns.set(threadId, (turn = { key, base: crypto.randomUUID(), from: 0, seq: 0 }));
    return turn;
  }

  /** Saves the turn so far plus `reply`. */
  async function save(threadId: string, resourceId: string, items: TurnItem[], reply: MemoryMessagePart[] = []) {
    if (readOnly || !items.some(m => m.role === 'user')) return;
    const { base, from, seq } = currentTurn(threadId, items);
    const messages = turnMessages(items, reply, suffix => `${base}-${suffix}${seq}`, from);
    if (messages.length) await client.saveMessages(threadId, { resourceId, messages });
  }

  /**
   * Call before each model call. Mid tool loop it saves the turn so far (observing first if over
   * threshold) and returns true: memory then serves the whole turn, so send only memory's prompt.
   */
  async function beforeStep(threadId: string, resourceId: string, items: TurnItem[]): Promise<boolean> {
    const lastUser = items.findLastIndex(m => m.role === 'user');
    if (readOnly || lastUser < 0 || !items.slice(lastUser + 1).some(m => m.role === 'tool')) return false;
    await save(threadId, resourceId, items);
    if ((await client.getObservationStatus(threadId)).shouldObserve) {
      await client.observe(threadId);
      const turn = currentTurn(threadId, items);
      turn.from = items.length;
      turn.seq++;
    }
    return true;
  }

  return { save, beforeStep };
}
