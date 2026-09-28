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

export function hashLabel(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function buildSankeyColorMap(names: string[]) {
  const ordered = [...new Set(names)].sort(
    (left, right) => hashLabel(left) - hashLabel(right) || left.localeCompare(right),
  );
  const colors: Record<string, string> = {};
  ordered.forEach((name, index) => {
    colors[name] = sankeySeriesColors[index % sankeySeriesColors.length] ?? 'var(--chart-blue)';
  });
  return colors;
}
