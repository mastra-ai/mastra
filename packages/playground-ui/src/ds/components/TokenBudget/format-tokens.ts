export function formatCompactTokens(value: number): string {
  if (value === 0) return '0';
  const k = value / 1000;
  const decimals = k < 0.1 ? 2 : 1;
  const formatted = k.toFixed(decimals);
  return formatted.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0$/, '$1');
}
