import { hashLabel } from '@/lib/colors';

export const sankeySeriesColors: readonly string[] = [
  'var(--chart-blue)',
  'var(--chart-orange)',
  'var(--chart-green)',
  'var(--chart-purple)',
  'var(--chart-pink)',
  'var(--chart-red)',
  'var(--chart-yellow)',
  'var(--chart-blue-deep)',
];

export function buildSankeyColorMap(names: string[]) {
  const colors: Record<string, string> = {};
  for (const name of names) {
    colors[name] = sankeySeriesColors[hashLabel(name) % sankeySeriesColors.length] ?? 'var(--chart-blue)';
  }
  return colors;
}
