import type { MessageEntry, TimelineEntry } from './transcript';

/** A user's turn and everything the run produced under it. */
export interface TurnGroup {
  key: string;
  entries: TimelineEntry[];
  /** The turn is opened by a user message, so it reserves room and anchors the scroll. */
  opensTurn: boolean;
}

/**
 * Cuts the timeline where the reader's attention moves: a user message starts a turn,
 * and everything the run answers with belongs to it.
 *
 * A gap marker sorts above the turn it introduces but arrives after it, so it moves
 * down into that turn — inside, the reserved room absorbs its height; outside, it
 * shifts the whole transcript a beat later.
 */
export function groupTurns(
  entries: TimelineEntry[],
  opensTurn: (entry: TimelineEntry) => boolean,
  introduces: (entry: TimelineEntry | undefined) => boolean,
): TurnGroup[] {
  const groups: TurnGroup[] = [];

  for (const entry of entries) {
    const opens = opensTurn(entry);
    const previous = groups.at(-1);
    if (!opens && previous) {
      previous.entries.push(entry);
      continue;
    }
    const introduction = previous && introduces(previous.entries.at(-1)) ? previous.entries.splice(-1) : [];
    groups.push({ key: entry.id, entries: [...introduction, entry], opensTurn: opens });
  }

  return groups;
}

/**
 * The assistant entries one reply is spread over. The run engine sends the reply as one
 * message but the server persists one per step, so a turn the reader sees as a single
 * answer reaches the timeline as several — reloaded history always, and a live turn as
 * soon as the window is revalidated under it.
 */
export function replySteps(group: TurnGroup): MessageEntry[] {
  return group.entries.flatMap(entry =>
    entry.kind === 'message' && entry.message.role === 'assistant' ? [entry] : [],
  );
}
