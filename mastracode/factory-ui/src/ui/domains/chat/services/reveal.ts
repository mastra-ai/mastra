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

/**
 * The words a part was written as, for the kinds the model writes word by word.
 * Reasoning streams delta by delta exactly like prose, so its passage takes its
 * words' time on the clock rather than one row's beat — a beat would hold the
 * block back whole, then let it land at once and grow unpaced.
 */
function partProse(part: MessagePart): string | undefined {
  if (part.type === 'text') return part.text;
  if (part.type === 'reasoning') return part.reasoning;
  return undefined;
}

/** What the reveal paces: the whole message, rows and cards written in as beats between the prose. */
export function messageScript(parts: MessagePart[]): string {
  return parts.map(part => partProse(part) ?? ROW_MARK).join(PASSAGE);
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

    if (part.type !== 'text' && part.type !== 'reasoning') {
      read = start + ROW_MARK.length;
      if (shown.length < read) break;
      revealed.push(part);
      continue;
    }

    const written = part.type === 'text' ? part.text : part.reasoning;
    read = start + written.length;

    const text = shown.slice(start, read);
    if (text === written) {
      revealed.push(part);
      continue;
    }

    if (text) revealed.push(part.type === 'text' ? { ...part, text } : { ...part, reasoning: text });
    break;
  }

  return revealed;
}
