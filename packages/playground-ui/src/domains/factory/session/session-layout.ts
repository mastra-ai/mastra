import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

/** A raised pill in the session header: title, stage bar, actions. */
export const headerCapsuleClass = cn(
  raisedSurfaceStyle,
  'pointer-events-auto flex w-fit min-w-0 items-center gap-0.5 rounded-full p-0.5 empty:hidden',
);

/** `elapsedLabel` reads under a minute as `<1m`, then minutes, hours and days. */
export function elapsedLabel(from: number, to: number): string {
  const ms = to - from;
  if (!Number.isFinite(ms) || ms < 60_000) return '<1m';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return hours % 24 === 0 ? `${days}d` : `${days}d ${hours % 24}h`;
}
