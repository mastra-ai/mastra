/** A user's turn and everything the run produced under it. */
export interface TurnGroup<T> {
  key: string;
  entries: T[];
  /** Opened by a user message, so it reserves room and anchors the scroll. */
  opensTurn: boolean;
}

export interface TurnRules<T> {
  key: (entry: T) => string;
  opensTurn: (entry: T) => boolean;
  /** A marker that belongs above the turn it introduces but arrives after the previous one, so it moves down. */
  introduces?: (entry: T) => boolean;
}

const introducesNothing = () => false;

/**
 * Cuts a timeline where the reader's attention moves: a user message starts a turn,
 * and everything the run answers with belongs to it. Entries before the first opener
 * form a turn of their own that opens nothing.
 */
export function groupTurns<T>(entries: T[], { key, opensTurn, introduces = introducesNothing }: TurnRules<T>) {
  const groups: TurnGroup<T>[] = [];

  for (const entry of entries) {
    const opens = opensTurn(entry);
    const previous = groups.at(-1);
    if (!opens && previous) {
      previous.entries.push(entry);
      continue;
    }
    const last = previous?.entries.at(-1);
    const introduction = previous && last !== undefined && introduces(last) ? previous.entries.splice(-1) : [];
    groups.push({ key: key(entry), entries: [...introduction, entry], opensTurn: opens });
  }

  return groups;
}
