const MAX_DISPLAYED_COUNT = 999;

function formatCount(count: number): string {
  return count > MAX_DISPLAYED_COUNT ? `${MAX_DISPLAYED_COUNT}+` : `${count}`;
}

/**
 * The exact counter text MatchNav renders, with values capped at "999+" so the width stays bounded
 * no matter how many matches there are. Exported so containers that overlay MatchNav on an input
 * (e.g. `SearchFieldBlock`) can size their padding from the real counter width.
 */
export function formatMatchCounter(current: number, total: number): string {
  return total === 0 ? '0/0' : `${formatCount(current)}/${formatCount(total)}`;
}
