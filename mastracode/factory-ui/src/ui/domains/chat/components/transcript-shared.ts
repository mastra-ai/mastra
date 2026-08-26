// Monospace, scrollable container for serialized args/results/file dumps.
export const resultBlock =
  'm-0 mt-1 max-h-72 max-w-full overflow-auto whitespace-pre rounded-sm bg-surface1 p-2 font-mono text-xs leading-normal text-icon5';

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export function stringify(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch {
    return String(v);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
