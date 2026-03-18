export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatDollars(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generateHourlyData() {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const date = new Date(now);
    date.setHours(date.getHours() - i);
    data.push({
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      hour: date.getHours(),
    });
  }
  return data;
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

export const LABEL_COLOR = '#a1a1aa';
