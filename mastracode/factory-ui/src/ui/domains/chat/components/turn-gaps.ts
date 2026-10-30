import type { MastraDBMessage } from '@mastra/core/agent-controller';

import type { TimelineEntry } from '../services/transcript';
import { isRecord } from './transcript-shared';
import { isTemporalGapSignal } from './TranscriptSignals';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOTICEABLE_MS = 10 * MINUTE;
const UNITS = [
  ['year', 365 * DAY],
  ['month', 30 * DAY],
  ['week', 7 * DAY],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
] as const;
const STAMP = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export interface TurnGap {
  label: string;
  title: string;
}

type Unit = (typeof UNITS)[number][0];

function unitFormat(unit: Unit): Intl.NumberFormat {
  return new Intl.NumberFormat('en', { style: 'unit', unit, unitDisplay: 'long' });
}

const AMOUNT: Record<Unit, Intl.NumberFormat> = {
  year: unitFormat('year'),
  month: unitFormat('month'),
  week: unitFormat('week'),
  day: unitFormat('day'),
  hour: unitFormat('hour'),
  minute: unitFormat('minute'),
};

function amount(value: number, unit: Unit): string {
  return AMOUNT[unit].format(value);
}

/** Worded like the reminder the agent gets for the same pause: "51 minutes later", "17 hours 17 minutes later". */
export function gapLabel(ms: number): string {
  for (const [index, [unit, size]] of UNITS.entries()) {
    const smaller = UNITS[index + 1];
    if (ms < size || !smaller) continue;
    const rest = Math.floor((ms % size) / smaller[1]);
    return [amount(Math.floor(ms / size), unit), rest > 0 && amount(rest, smaller[0]), 'later']
      .filter(Boolean)
      .join(' ');
  }
  return `${amount(Math.round(ms / MINUTE), 'minute')} later`;
}

function span(message: MastraDBMessage): { first: number; last: number } {
  const stamps = message.content.parts.flatMap(part =>
    isRecord(part) && typeof part.createdAt === 'number' ? [part.createdAt] : [],
  );
  const created = new Date(message.createdAt).getTime();
  return { first: stamps[0] ?? created, last: stamps.at(-1) ?? created };
}

/**
 * The pauses a reader would notice: a turn opened ten minutes or more after the conversation last moved, keyed by
 * the entry that opens it. Read from the messages themselves, so a message sent after a pause carries its divider
 * the moment it lands.
 */
export function turnGaps(
  entries: readonly TimelineEntry[],
  opensTurn: (entry: TimelineEntry) => boolean,
): Map<string, TurnGap> {
  const gaps = new Map<string, TurnGap>();
  let lastMoved: number | undefined;
  for (const entry of entries) {
    if (entry.kind !== 'message' || isTemporalGapSignal(entry)) continue;
    const { first, last } = span(entry.message);
    if (lastMoved !== undefined && first - lastMoved >= NOTICEABLE_MS && opensTurn(entry)) {
      gaps.set(entry.id, { label: gapLabel(first - lastMoved), title: STAMP.format(first) });
    }
    lastMoved = last;
  }
  return gaps;
}
