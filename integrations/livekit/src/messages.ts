import type { llm } from '@livekit/agents';

export type VoiceTurnMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

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
  if (item.role === 'user') return { role: 'user', content };
  if (item.role === 'assistant') return { role: 'assistant', content };
  // 'system' and 'developer' both map to a Mastra system message.
  return { role: 'system', content };
}

/**
 * Extracts only the messages added since the agent last spoke. Used when Mastra Memory is
 * the source of truth for conversation history: prior turns are already persisted in the
 * thread, so re-sending them would duplicate history.
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
  const messages: VoiceTurnMessage[] = [];
  for (const item of items.slice(lastAssistantIdx + 1)) {
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
