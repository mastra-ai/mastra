/**
 * Shape math for the Traces page: every card laid on a real time axis, and how
 * many the board was holding at each moment. Pure over wire rows, so the views
 * stay views and the geometry is testable on its own.
 */

import { formatDuration } from '../../../lib/date';
import type { WorkItem, WorkItemStageEntry } from './services/workItems';
import { stageLabel, stageOrder, stagePaint } from './stages';

export const ROW = 22;
export const HEAD = 40;
/** Rows past this are dropped rather than drawn unreadably thin. */
const MAX_ROWS = 34;
const SAMPLES = 72;
const NARROW_BELOW = 700;

/** Ordered, because the pipeline is: a trace reads left to right through these. */
export const DRAWN_STAGES = ['intake', 'triage', 'planning', 'execute', 'review'];
const BANDED_STAGES = DRAWN_STAGES.filter(stage => stage !== 'intake');
const TERMINAL_STAGES = ['done', 'canceled'];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface TraceWindow {
  id: string;
  label: string;
  spanMs: number;
  tickMs: number;
}

export const TRACE_WINDOWS: TraceWindow[] = [
  { id: 'day', label: '24 hours', spanMs: DAY, tickMs: 3 * HOUR },
  { id: 'week', label: '7 days', spanMs: 7 * DAY, tickMs: DAY },
  { id: 'month', label: '30 days', spanMs: 30 * DAY, tickMs: DAY },
];

export interface Segment {
  key: string;
  x: number;
  width: number;
  fill: string;
  /** Intake is the wait before the factory took the card — drawn, but held back. */
  faded: boolean;
  open: boolean;
  detail: string;
}

export interface Row {
  key: string;
  title: string;
  cardKey: string;
  y: number;
  mid: number;
  segments: Segment[];
  hops: string[];
  shippedAt: number | null;
  canceledAt: number | null;
  liveAt: number | null;
  detail: string[];
  described: string;
}

export interface Tick {
  x: number;
  label: string | null;
}

/** Cards holding each stage across the window, sampled on a fixed grid. */
export interface Occupancy {
  stamps: number[];
  xs: number[];
  series: { stage: string; fill: string; color: string; values: number[] }[];
  totals: number[];
  peak: number;
}

export interface Shape {
  width: number;
  height: number;
  gutter: number;
  nowX: number;
  ticks: Tick[];
  rows: Row[];
  band: Occupancy;
  hidden: number;
}

function time(iso: string): number {
  return Date.parse(iso);
}

function isLive(item: WorkItem, running: ReadonlySet<string>): boolean {
  return Object.values(item.sessions).some(session => running.has(session.sessionId));
}

/** A card's stay in one stage, clipped to the window. */
function stayEnd(entry: WorkItemStageEntry, now: number): number {
  return entry.exitedAt ? time(entry.exitedAt) : now;
}

/** `github-issue:21896` reads as `#21896` — the number is how people name a card. */
function cardKey(item: WorkItem): string {
  const tail = item.sourceKey?.split(':').at(-1);
  return tail ? `#${tail}` : '';
}

function formatTick(at: number, window: TraceWindow): string {
  const date = new Date(at);
  if (window.tickMs < DAY) return `${String(date.getHours()).padStart(2, '0')}:00`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A moment named to the minute — what a reader needs once they point at one. */
export function momentLabel(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Whether the window would draw anything for this card. A card that only ever
 * sat in intake has a history but no trace: an empty row reads as a card that
 * stalled, which is the opposite of what it means.
 */
function movedInWindow(item: WorkItem, from: number, now: number): boolean {
  return item.stageHistory.some(entry =>
    entry.stage === 'intake'
      ? false
      : DRAWN_STAGES.includes(entry.stage)
        ? stayEnd(entry, now) > from
        : TERMINAL_STAGES.includes(entry.stage) && time(entry.enteredAt) > from,
  );
}

/** Cards with a run in progress right now. */
export function underAgent(items: WorkItem[], running: ReadonlySet<string>): number {
  return items.filter(item => isLive(item, running)).length;
}

/** The cards this window has something to say about, newest activity first. */
export function tracedInWindow(items: WorkItem[], window: TraceWindow, now: number): WorkItem[] {
  return items
    .filter(item => movedInWindow(item, now - window.spanMs, now))
    .sort((a, b) => lastTouch(b, now) - lastTouch(a, now));
}

function lastTouch(item: WorkItem, now: number): number {
  return Math.max(...item.stageHistory.map(entry => stayEnd(entry, now)), 0);
}

function firstTouch(item: WorkItem, from: number): number {
  return Math.max(Math.min(...item.stageHistory.map(entry => time(entry.enteredAt))), from);
}

export function buildShape(
  box: number,
  traced: WorkItem[],
  running: ReadonlySet<string>,
  window: TraceWindow,
  now: number,
): Shape {
  const from = now - window.spanMs;
  const to = now + window.spanMs * 0.04;
  const gutter = box < NARROW_BELOW ? 108 : 300;
  const plot = Math.max(box - gutter - 24, 120);
  const at = (moment: number) => gutter + ((moment - from) / (to - from)) * plot;

  const ordered = traced.slice(0, MAX_ROWS).sort((a, b) => firstTouch(a, from) - firstTouch(b, from));

  const stamps: number[] = [];
  const first = Math.ceil(from / window.tickMs) * window.tickMs;
  for (let moment = first; moment <= now; moment += window.tickMs) stamps.push(moment);
  const every = Math.max(1, Math.ceil((stamps.length * 56) / plot));
  const nowX = at(now);
  const ticks = stamps.map((moment, index) => {
    const x = at(moment);
    // the NOW marker owns the right edge; a tick label under it reads as one word
    const labelled = index % every === 0 && Math.abs(x - nowX) > 36;
    return { x, label: labelled ? formatTick(moment, window) : null };
  });

  const rows = ordered.map((item, index): Row => {
    const y = HEAD + index * ROW;
    const mid = y + ROW / 2 - 3;
    const history = item.stageHistory;

    const segments = history
      .map((entry, position): Segment | null => {
        if (!DRAWN_STAGES.includes(entry.stage)) return null;
        const end = stayEnd(entry, now);
        if (end <= from) return null;
        const x = Math.max(at(time(entry.enteredAt)), gutter);
        const width = Math.max(2, at(end) - x);
        const held = end - time(entry.enteredAt);
        return {
          key: `${entry.stage}-${position}`,
          x,
          width,
          fill: stagePaint(entry.stage).fill,
          faded: entry.stage === 'intake',
          open: !entry.exitedAt,
          detail: `${stageLabel(entry.stage)} · ${formatDuration(held)}`,
        };
      })
      .filter((segment): segment is Segment => segment !== null);

    const hops = history
      .map((entry, position) => {
        const previous = history[position - 1];
        if (!previous?.exitedAt || stageOrder(entry.stage) >= stageOrder(previous.stage)) return null;
        const start = at(time(previous.exitedAt));
        if (start < gutter) return null;
        const end = Math.min(start - 14, at(time(entry.enteredAt)));
        return `M${start.toFixed(1)} ${mid} C ${start.toFixed(1)} ${mid - 13}, ${end.toFixed(1)} ${mid - 13}, ${end.toFixed(1)} ${mid}`;
      })
      .filter((path): path is string => path !== null);

    const entered = (stage: string) => {
      const moment = history.find(entry => entry.stage === stage)?.enteredAt;
      return moment && time(moment) > from ? at(time(moment)) : null;
    };

    const held = history.at(-1)!;
    const age = now - time(held.enteredAt);
    const detail = [
      `${stageLabel(held.stage)} · ${formatDuration(age)}`,
      `In the factory ${formatDuration(now - time(item.createdAt))}`,
      ...(hops.length > 0 ? [`${hops.length}× sent back`] : []),
    ];

    return {
      key: item.id,
      title: item.title,
      cardKey: cardKey(item),
      y,
      mid,
      segments,
      hops,
      shippedAt: entered('done'),
      canceledAt: entered('canceled'),
      liveAt: isLive(item, running) ? at(now) : null,
      detail,
      described: `${item.title} — ${stageLabel(held.stage)} since ${formatDuration(age)}`,
    };
  });

  return {
    width: box,
    height: HEAD + Math.max(rows.length, 1) * ROW + 6,
    gutter,
    nowX,
    ticks,
    rows,
    band: occupancy(traced, from, now, at),
    hidden: traced.length - rows.length,
  };
}

/**
 * Whether a stay covers the moment. An open stay is read as open rather than as
 * ending now, or the last sample — which is always `now` — would drop every
 * card still in the stage and draw the board emptying itself.
 */
function held(stage: string, moment: number) {
  return (entry: WorkItemStageEntry) =>
    entry.stage === stage &&
    time(entry.enteredAt) <= moment &&
    (entry.exitedAt === undefined || time(entry.exitedAt) > moment);
}

/** How many cards sat in each pipeline stage, sampled across the window. */
function occupancy(items: WorkItem[], from: number, now: number, at: (moment: number) => number): Occupancy {
  const step = (now - from) / SAMPLES;
  const stamps = Array.from({ length: SAMPLES + 1 }, (_, index) => from + index * step);
  const series = BANDED_STAGES.map(stage => ({
    stage,
    fill: stagePaint(stage).fill,
    color: stagePaint(stage).color,
    values: stamps.map(moment => items.filter(item => item.stageHistory.some(held(stage, moment))).length),
  }));
  const totals = stamps.map((_, index) => series.reduce((sum, entry) => sum + entry.values[index]!, 0));
  return { stamps, xs: stamps.map(at), series, totals, peak: Math.max(...totals, 0) };
}
