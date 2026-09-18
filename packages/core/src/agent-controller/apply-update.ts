import type { MastraDBMessage } from '../agent/message-list/state/types';
import type { AgentControllerEvent } from './types';

/** The compact delta carried by a `message_update` event. */
export type AgentControllerMessageUpdate = Extract<AgentControllerEvent, { type: 'message_update' }>['event'];

/**
 * Fold one compact `message_update` delta into a streamed assistant message.
 *
 * Returns a new message (the input is never mutated), or `undefined` when the
 * delta does not apply — no message, a string `content` (no parts to fold), or
 * a reasoning delta whose index is not a reasoning part. There is deliberately
 * no `role` guard: role checks belong to callers. Callers address the message
 * by id: `applyUpdate(messages.get(event.id), event.event)`.
 */
export function applyUpdate(
  message: MastraDBMessage | undefined,
  update: AgentControllerMessageUpdate,
): MastraDBMessage | undefined {
  if (!message || typeof message.content === 'string') return undefined;

  const parts = [...message.content.parts];
  if (update.type === 'text-delta') {
    const textIndex = parts.findLastIndex(part => part.type === 'text');
    const textPart = parts[textIndex];
    if (textPart?.type === 'text') {
      parts[textIndex] = { ...textPart, text: textPart.text + update.delta };
    } else {
      parts.push({ type: 'text', text: update.delta });
    }
  } else if (update.type === 'reasoning-delta') {
    const reasoningPart = parts[update.index];
    if (reasoningPart?.type !== 'reasoning') return undefined;
    const reasoning = reasoningPart.reasoning + update.delta;
    parts[update.index] = { ...reasoningPart, reasoning, details: [{ type: 'text', text: reasoning }] };
  } else {
    parts[update.index] = structuredClone(update.part);
  }

  return { ...message, content: { ...message.content, parts } };
}
