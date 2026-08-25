import type { MastraDBMessage } from '@mastra/core/agent-controller';

type MessagePart = MastraDBMessage['content']['parts'][number];

/** What separates two passages of prose that were streamed as separate blocks. */
const PASSAGE = '\n\n';

/**
 * A part that is not prose, written into the reveal's script as words so it takes a
 * beat on the same clock: a burst of parallel tool calls cascades in row by row, at
 * the pace the reply is moving, instead of landing as one block.
 */
const ROW_MARK = Array.from({ length: 6 }, () => '￼').join(' ');

/** A message's prose as the one stream it was written as — the copyable answer. */
export function messageProse(parts: MessagePart[]): string {
  return parts.flatMap(part => (part.type === 'text' ? [part.text] : [])).join(PASSAGE);
}

/** What the reveal paces: the whole message, rows and cards written in as beats between the prose. */
export function messageScript(parts: MessagePart[]): string {
  return parts.map(part => (part.type === 'text' ? part.text : ROW_MARK)).join(PASSAGE);
}

/**
 * The parts of a message a reveal has reached, `shown` being a prefix of the script.
 *
 * A reply is not only prose: a tool row, a card, a reasoning block sit between its
 * passages, and they were written in that order. Pacing the prose alone would lay a
 * sentence down word by word while the row that follows it is already on screen — so
 * every part waits its turn on the one clock, and the reader is handed the answer in
 * the order it was written.
 */
export function revealedParts(parts: MessagePart[], shown: string): MessagePart[] {
  const script = messageScript(parts);
  if (shown.length >= script.length) return parts;

  const revealed: MessagePart[] = [];
  let read = 0;

  for (const part of parts) {
    const start = read === 0 ? 0 : read + PASSAGE.length;
    read = start + (part.type === 'text' ? part.text.length : ROW_MARK.length);

    if (part.type !== 'text') {
      if (shown.length < read) break;
      revealed.push(part);
      continue;
    }

    const text = shown.slice(start, read);
    if (text === part.text) {
      revealed.push(part);
      continue;
    }

    if (text) revealed.push({ ...part, text });
    break;
  }

  return revealed;
}
