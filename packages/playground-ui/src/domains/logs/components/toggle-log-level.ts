import type { LogLevel } from '../types';

export function toggleLogLevel(
  levels: readonly LogLevel[],
  selected: readonly LogLevel[],
  level: LogLevel,
  only: boolean,
): LogLevel[] {
  if (only) return selected.length === 1 && selected[0] === level ? [...levels] : [level];
  if (!selected.includes(level)) return levels.filter(l => l === level || selected.includes(l));
  const next = levels.filter(l => l !== level && selected.includes(l));
  return next.length === 0 ? [...levels] : next;
}
