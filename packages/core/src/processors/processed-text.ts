import type { MastraDBMessage, MessageList } from '../agent/message-list';

export function textParts(message: MastraDBMessage): string[] {
  return message.content.parts.filter(part => part.type === 'text').map(part => part.text);
}

/** Keep the legacy text mirror consistent when a final processor changes primary text. */
export function normalizeProcessedText(
  messages: MastraDBMessage[],
  before: Map<string, string[]>,
  messageList?: MessageList,
): void {
  let unsavedIds: Set<string> | undefined;
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const previous = before.get(message.id);
    const current = textParts(message);
    if (
      previous
        ? previous.length !== current.length || previous.some((text, index) => text !== current[index])
        : current.length > 0 && message.content.content !== current.join('')
    ) {
      message.content.content = current.join('');
      // In-place edits to an earlier saved response must enter the existing save path.
      if (messageList) {
        unsavedIds ??= new Set(messageList.get.response.db().map(live => live.id));
        if (!unsavedIds.has(message.id)) {
          messageList.add(message, 'response', { merge: false });
          unsavedIds.add(message.id);
        }
      }
    }
  }
}
