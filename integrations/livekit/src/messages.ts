import type { llm } from '@livekit/agents';

/**
 * Fixed id LiveKit gives the customer Agent's instructions when it injects them as a leading
 * `role: 'system'` message into the chat context passed to `chat()` / `llmNode`. We drop this
 * item so the server-side Mastra agent's own system prompt is authoritative. See D11.
 */
export const LIVEKIT_INSTRUCTIONS_MESSAGE_ID = 'lk.agent_task.instructions';

/**
 * A message bound for `agent.stream(...)` (in-process) or the Mastra server stream route (remote).
 * `id` carries the LiveKit `ChatMessage.id` so the server can dedupe/upsert by id — making
 * base-class retries, preemptive double-sends, and the D7 reconciliation recipe idempotent (D12).
 */
export type VoiceTurnMessage =
  | { role: 'system'; content: string; id?: string }
  | { role: 'user'; content: string; id?: string }
  | { role: 'assistant'; content: string; id?: string };

function textOfMessage(message: llm.ChatMessage): string {
  const parts: string[] = [];
  for (const part of message.content) {
    if (typeof part === 'string') {
      parts.push(part);
    } else if (part.type === 'instructions') {
      parts.push(part.value);
    } else if (part.type === 'audio_content' && part.transcript) {
      parts.push(part.transcript);
    }
  }
  return parts.join('\n').trim();
}

function toVoiceTurnMessage(item: llm.ChatItem): VoiceTurnMessage | undefined {
  if (item.type !== 'message') return undefined;
  const content = textOfMessage(item);
  if (!content) return undefined;
  const id = item.id;
  if (item.role === 'user') return { role: 'user', content, id };
  if (item.role === 'assistant') return { role: 'assistant', content, id };
  // 'system' and 'developer' both map to a Mastra system message.
  return { role: 'system', content, id };
}

/**
 * Extracts only the messages added since the agent last spoke. Used when Mastra Memory is
 * the source of truth for conversation history: prior turns are already persisted in the
 * thread, so re-sending them would duplicate history.
 *
 * Two extensions over the naive "slice after the last assistant message":
 *
 * - **D7 self-heal:** when the last assistant message was cut off by barge-in
 *   (`interrupted: true`), the server never persisted it — aborted runs skip persistence — so
 *   its heard-only text is missing from the thread. Re-send that fragment (ordered first) this
 *   turn to backfill it. It stops being "the last assistant message" once a full reply lands,
 *   so each interrupted fragment is sent exactly once, on the following turn.
 * - **D11 instructions filter:** LiveKit injects the customer Agent's `instructions` as a
 *   leading `system` message ({@link LIVEKIT_INSTRUCTIONS_MESSAGE_ID}); the server-side Mastra
 *   agent owns its own system prompt, so drop it (it would otherwise ship on the first turn,
 *   before any assistant message).
 */
export function extractNewTurnMessages(chatCtx: llm.ChatContext): VoiceTurnMessage[] {
  const items = chatCtx.items;
  let lastAssistantIdx = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item?.type === 'message' && item.role === 'assistant') {
      lastAssistantIdx = i;
      break;
    }
  }
  const lastAssistant = lastAssistantIdx >= 0 ? items[lastAssistantIdx] : undefined;
  const healInterrupted =
    lastAssistant?.type === 'message' && lastAssistant.role === 'assistant' && lastAssistant.interrupted;
  // Include the interrupted fragment (D7) by starting the slice AT it, otherwise start strictly after.
  const startIdx = healInterrupted ? lastAssistantIdx : lastAssistantIdx + 1;

  const messages: VoiceTurnMessage[] = [];
  for (const item of items.slice(startIdx)) {
    if (item.type === 'message' && item.id === LIVEKIT_INSTRUCTIONS_MESSAGE_ID) continue;
    const message = toVoiceTurnMessage(item);
    if (message) messages.push(message);
  }
  return messages;
}

/**
 * Converts the full LiveKit chat context to Mastra messages. Used when the bridge runs
 * without Mastra Memory and LiveKit's in-session context is the only history. The agent's
 * LiveKit-level instructions are excluded — the Mastra agent applies its own instructions.
 */
export function chatContextToMessages(chatCtx: llm.ChatContext): VoiceTurnMessage[] {
  const withoutInstructions = chatCtx.copy({ excludeInstructions: true, excludeFunctionCall: true });
  const messages: VoiceTurnMessage[] = [];
  for (const item of withoutInstructions.items) {
    const message = toVoiceTurnMessage(item);
    if (message) messages.push(message);
  }
  return messages;
}
