export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatCost(value: number, unit?: string | null): string {
  if (unit?.toLowerCase() === 'usd' || !unit) {
    return `$${value < 0.01 && value > 0 ? value.toFixed(4) : value.toFixed(2)}`;
  }
  return `${value.toFixed(4)} ${unit}`;
}

export const CHART_COLORS = {
  green: '#22c55e',
  orange: '#fb923c',
  pink: '#f472b6',
  purple: '#8b5cf6',
  blue: '#4f83f1',
  blueDark: '#2b5cd9',
  blueLight: '#6b8fe5',
  red: '#f87171',
  greenDark: '#15613a',
  redDark: '#991b1b',
  yellow: '#facc15',
} as const;
