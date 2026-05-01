export function formatVersionLabel(type: 'Dataset' | 'Agent', value: string | number): string {
  const isNumeric = typeof value === 'number' || /^\d+(\.\d+)*$/.test(String(value));
  return isNumeric ? `${type} v${value}` : `${type} ${value}`;
}
