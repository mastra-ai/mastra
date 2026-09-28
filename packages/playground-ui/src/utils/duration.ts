import { toSigFigs } from './number';

export function formatDuration(durationMs: number | null | undefined, { signed = false }: { signed?: boolean } = {}) {
  if (durationMs == null || !Number.isFinite(durationMs)) return undefined;
  if (signed) {
    if (durationMs === 0) return formatUnsigned(0);
    return `${durationMs > 0 ? '+' : '-'}${formatUnsigned(Math.abs(durationMs))}`;
  }
  if (durationMs < 0) return undefined;
  return formatUnsigned(durationMs);
}

function formatUnsigned(durationMs: number) {
  if (durationMs < 1_000) return `${toSigFigs(durationMs, 3)}ms`;

  const seconds = durationMs / 1_000;
  if (seconds < 60) return `${toSigFigs(seconds, 3)}s`;

  const [minutes, hours, days] = [Math.floor(seconds / 60), Math.floor(seconds / 3_600), Math.floor(seconds / 86_400)];
  if (minutes < 60) return withRemainder(`${minutes}m`, Math.floor(seconds % 60), 's');
  if (hours < 24) return withRemainder(`${hours}h`, minutes % 60, 'm');
  return withRemainder(`${days}d`, hours % 24, 'h');
}

function withRemainder(head: string, remainder: number, unit: string) {
  return remainder > 0 ? `${head} ${remainder}${unit}` : head;
}

/** Millisecond-precise duration for span timelines: `123 ms`, `1.234 s`. */
export function formatDurationPrecise(durationMs: number | null | undefined) {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) return undefined;
  return durationMs < 1_000 ? `${Math.round(durationMs)} ms` : `${(durationMs / 1_000).toFixed(3)} s`;
}

/** Live counter label with a fixed decimal so the width stays stable: `3.2s`. */
export function formatElapsed(elapsedMs: number) {
  return `${(elapsedMs / 1_000).toFixed(1)}s`;
}
