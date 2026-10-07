import type { MetricsShareListProps, MetricsShareListRow } from './metrics-share-list-types';

/** A row's color and how strongly it shows: fainter rows fade toward the card, not to gray. */
export type Paint = { color: string; alpha: number };

/** A listed row with its color and the strip segment it highlights. */
export type ShownRow = MetricsShareListRow & { paint: Paint; segment: string };

export type StripSegment = { key: string; paint: Paint; /** flex-grow, in percent of the strip. */ grow: number };

type Palette = NonNullable<MetricsShareListProps['palette']>;

/** Brand green, toned down for large fills. Theme token: tuned for dark and light. */
export const DEFAULT_COLOR = 'var(--chart-share-1)';
/**
 * Cool hues for long lists: green, sky, violet, teal, indigo, ordered so neighbours sit far
 * apart on the wheel; no warning amber or error red. The first row's color leads.
 */
const HUES = [1, 2, 3, 4, 5].map(i => `var(--chart-share-${i})`);
/** The palette after a custom lead color: violet, teal, sky, indigo, then green last. */
const CUSTOM_LEAD_HUES = [3, 4, 2, 5, 1].map(i => `var(--chart-share-${i})`);
const SHADES = [1, 0.7, 0.48, 0.32, 0.2, 0.14];
const REST: Paint = { color: 'var(--chart-share-rest)', alpha: 1 };
/** Rows with their own strip segment; past that, segments get too thin and share the gray one. */
const SEGMENTS = 50;
export const REST_KEY = '__rest';

function rowColors(base: string, count: number, palette: Palette): Paint[] {
  if (palette === 'hues') {
    // A lead color from the palette moves to the front. Any other color leads the violet and teal
    // hues first: custom leads are usually green or blue, which sit next to the palette's own
    // green and sky.
    const hues = HUES.includes(base) ? [base, ...HUES.filter(h => h !== base)] : [base, ...CUSTOM_LEAD_HUES];
    return Array.from({ length: count }, (_, i) => ({
      color: hues[i % hues.length] ?? base,
      alpha: [1, 0.55, 0.3][Math.floor(i / hues.length)] ?? 0.2,
    }));
  }
  return Array.from({ length: count }, (_, i) => ({ color: base, alpha: SHADES[i] ?? 0.1 }));
}

export const sumShares = (rows: MetricsShareListRow[]) => rows.reduce((sum, r) => sum + Math.max(r.share, 0), 0);

/**
 * Largest first, so the strongest color is always the biggest share. A missing, negative or
 * infinite share counts as zero, so one bad row can't break the order or the percentages.
 */
export function rankRows(rows: MetricsShareListRow[]): MetricsShareListRow[] {
  return rows
    .map(r => (Number.isFinite(r.share) && r.share > 0 ? r : { ...r, share: 0 }))
    .toSorted((a, b) => b.share - a.share);
}

type Colors = { color: string; palette: Palette };

/** The top rows, then one "Other" row folding the tail, unless that would hide a single row. */
export function foldRows(
  ranked: MetricsShareListRow[],
  { limit, other, color, palette }: Colors & Pick<MetricsShareListProps, 'other'> & { limit: number },
) {
  if (ranked.length <= limit + 1) return { shown: paintRows(ranked, color, palette), rest: [] };
  const rest = ranked.slice(limit);
  const folded = other?.(rest);
  const otherRow: ShownRow = {
    key: REST_KEY,
    label: `Other (${rest.length})`,
    share: sumShares(rest),
    value: folded?.value,
    cells: folded?.cells,
    paint: REST,
    segment: REST_KEY,
  };
  return { shown: [...paintRows(ranked.slice(0, limit), color, palette), otherRow], rest };
}

function paintRows(rows: MetricsShareListRow[], color: string, palette: Palette): ShownRow[] {
  const colors = rowColors(color, rows.length, palette);
  return rows.map((r, i) => ({ ...r, paint: colors[i] ?? REST, segment: r.key }));
}

/**
 * The first `count` rows, plus the active row when it ranks past them. Rows past the strip's
 * own segments are gray and share its "everything else" segment.
 */
export function pageRows(
  ranked: MetricsShareListRow[],
  { count, activeKey, color, palette }: Colors & { count: number; activeKey?: string },
) {
  const own = Math.min(count, ranked.length, SEGMENTS);
  const colors = rowColors(color, own, palette);
  const rank = new Map(ranked.map((r, i) => [r.key, i]));
  const shown = listedRows(ranked, count, activeKey).map(r => {
    const i = rank.get(r.key) ?? ranked.length;
    return { ...r, paint: colors[i] ?? REST, segment: i < own ? r.key : REST_KEY };
  });
  return { shown, rest: ranked.slice(own) };
}

function listedRows(ranked: MetricsShareListRow[], count: number, activeKey?: string) {
  const listed = ranked.slice(0, count);
  const active = activeKey ? ranked.findIndex(r => r.key === activeKey) : -1;
  const pinned = active >= count ? ranked[active] : undefined;
  return pinned ? [...listed, pinned] : listed;
}

/** One segment per row with its own color, then everything else in one gray segment. */
export function stripSegments(shown: ShownRow[], rest: MetricsShareListRow[]): StripSegment[] {
  const own = shown.filter(r => r.segment !== REST_KEY).map(r => ({ key: r.key, share: r.share, paint: r.paint }));
  const gray = rest.length ? [{ key: REST_KEY, share: sumShares(rest), paint: REST }] : [];
  const segments = [...own, ...gray].filter(s => s.share > 0);
  // Grow factors in percent: flex-grow values that sum below 1 (shares like $0.09 of cost)
  // would leave the rest of the strip empty.
  const total = segments.reduce((sum, s) => sum + s.share, 0);
  return segments.map(s => ({ key: s.key, paint: s.paint, grow: (s.share / total) * 100 }));
}

/** The strip segment a hovered row (or segment) lights up. */
export function hoveredSegment(shown: ShownRow[], hover?: string) {
  if (hover === undefined) return undefined;
  return shown.find(r => r.key === hover)?.segment ?? hover;
}

/** Dim every segment but the lit one, while one is. */
export const isSegmentDimmed = (key: string, lit?: string) => lit !== undefined && lit !== key;

/** Dim every row but the hovered one; hovering the gray segment keeps all its rows lit. */
export function isRowDimmed(row: ShownRow, hover?: string) {
  if (hover === undefined || hover === row.key) return false;
  return !(hover === REST_KEY && row.segment === REST_KEY);
}

export const fmtShare = (n: number, total: number) => {
  const r = n / (total || 1);
  if (!(r > 0)) return '0%';
  if (r < 0.001) return '<0.1%';
  return `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`;
};
