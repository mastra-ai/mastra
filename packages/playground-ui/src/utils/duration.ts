import { toSigFigs } from './number';

export function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return undefined;
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
