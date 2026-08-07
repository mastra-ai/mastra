export interface TDomain {
  tMin: number;
  tMax: number;
}

export function parseUTC(ts: string): number {
  if (/[Zz+-]\d{0,4}$/.test(ts.trim())) return new Date(ts).getTime();
  return new Date(ts.trim().replace(' ', 'T') + 'Z').getTime();
}

export function timestampsToTDomain(timestamps: string[]): TDomain {
  if (timestamps.length === 0) return { tMin: 0, tMax: 1 };

  let min = Infinity;
  let max = -Infinity;

  for (const ts of timestamps) {
    const t = parseUTC(ts);
    if (t < min) min = t;
    if (t > max) max = t;
  }

  if (min === max) return { tMin: min, tMax: min + 1 };

  return { tMin: min, tMax: max };
}

export function toT(isoString: string, domain: TDomain): number {
  const t = parseUTC(isoString);
  return (t - domain.tMin) / (domain.tMax - domain.tMin);
}

export function tToTimestamp(t: number, domain: TDomain): Date {
  return new Date(domain.tMin + t * (domain.tMax - domain.tMin));
}

export function formatTimeDisplay(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const m = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${day}/${month} ${h}:${m}:${s}`;
}
