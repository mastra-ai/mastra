/** The window of the same length immediately before this one. */
export function previousWindow({ start, end }: { start: Date; end: Date }) {
  return { start: new Date(2 * start.getTime() - end.getTime()), end: new Date(start.getTime()) };
}

/** "24 hours", "7 days": how a card names the window it compares with. */
export function windowLength({ start, end }: { start: Date; end: Date }) {
  const hours = Math.round((end.getTime() - start.getTime()) / 3_600_000);
  if (hours < 48 || hours % 24 !== 0) return hours === 1 ? 'hour' : `${hours} hours`;
  return `${hours / 24} days`;
}
