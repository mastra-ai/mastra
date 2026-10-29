/** `agent run: 'chef-agent'` → `['agent run', 'chef-agent']`; names without a `kind: ` prefix stay whole. */
export function splitSpanName(name: string): [kind: string | null, value: string] {
  const index = name.indexOf(': ');
  if (index < 0) return [null, name];
  return [name.slice(0, index), name.slice(index + 2).replace(/^'(.*)'$/, '$1')];
}

/** Fractions of the trace duration marked on the axis and drawn as gridlines behind the bars. */
export const TIMELINE_TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Horizontal padding of the time track. The right side is wider so the duration printed after a bar
 * that ends with the trace still fits; the axis header uses the same padding to stay aligned.
 */
export const TIMELINE_TRACK_PADDING = 'pl-2 pr-16';

/** Name column, then the time track. Shared by the timeline grid and the cursor overlay drawn over it. */
export const TIMELINE_COLUMNS = 'grid-cols-[minmax(12rem,2fr)_minmax(12rem,3fr)]';
