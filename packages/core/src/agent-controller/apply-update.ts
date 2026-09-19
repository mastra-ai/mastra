import type { MastraDBMessage } from '../agent/message-list/state/types';
import type { AgentControllerEvent } from './types';

/** The compact delta carried by a `message_update` event. */
export type AgentControllerMessageUpdate = Extract<AgentControllerEvent, { type: 'message_update' }>['event'];

/**
 * Fold one compact `message_update` delta into a streamed assistant message.
 *
 * Returns a new message (the input is never mutated), or `undefined` when the
 * delta does not apply — no message, a string `content` (no parts to fold), a
 * reasoning delta whose index is not a reasoning part, or a part update whose
 * index is past the append boundary. A part update at `parts.length` applies by
 * appending; only indices greater than that do not. There is deliberately no
 * `role` guard:
 * role checks belong to callers. Callers address the message by id:
 * `applyUpdate(messages.get(event.id), event.event)`.
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
    // The emitter appends a new part at `parts.length` and replaces existing
    // ones by index, so anything else — negative, fractional, or past the
    // append boundary — would write a hole or a non-element property.
    if (!Number.isInteger(update.index) || update.index < 0 || update.index > parts.length) return undefined;
    parts[update.index] = structuredClone(update.part);
  }

  return { ...message, content: { ...message.content, parts } };
}
