export const toSigFigs = (num: number, sigFigs: number) => {
  // toPrecision  returns significant digits formatted with potentially exponential notation
  // Number() converts the exponential notation to a regular number
  return Number(num.toPrecision(sigFigs));
};

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function formatBytes(bytes: number | null | undefined): string | undefined {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return undefined;
  const exponent = bytes < 1 ? 0 : Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const rounded = exponent === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${BYTE_UNITS[exponent]}`;
}

const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export function formatPercent(
  ratio: number | null | undefined,
  { signed = false }: { signed?: boolean } = {},
): string | undefined {
  if (ratio == null || !Number.isFinite(ratio)) return undefined;
  const sign = ratio < 0 ? '-' : signed && ratio > 0 ? '+' : '';
  if (ratio !== 0 && Math.abs(ratio) < 0.001) return `${sign}<0.1%`;
  return `${sign}${percent.format(Math.abs(ratio))}`;
}
