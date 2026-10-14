import { formatDuration } from '@mastra/playground-ui/utils/duration';

export const formatScore = (value: number | null) => (value != null ? value.toFixed(2) : '-');

export const formatDurationDelta = (ms: number) => formatDuration(ms) ?? '-';

export const diff = (value: number | null | undefined, baseline: number | null | undefined) =>
  value != null && baseline != null ? value - baseline : null;

const currencyCodes = new Set(Intl.supportedValuesOf('currency'));

/**
 * Per-item costs are usually fractions of a cent, so amounts below 1 keep three significant
 * digits instead of collapsing to `<$0.01`. Larger amounts round to two decimals.
 */
export const formatCostValue = (value?: number, unit?: string): string => {
  if (value === undefined) return '-';
  const digits: Intl.NumberFormatOptions =
    value !== 0 && Math.abs(value) < 1
      ? { maximumSignificantDigits: 3 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const currency = (unit ?? 'usd').toUpperCase();
  if (currencyCodes.has(currency)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, ...digits }).format(value);
  }
  return `${new Intl.NumberFormat('en-US', digits).format(value)} ${unit}`;
};

export const costDeltaFormatter = (unit?: string) => (absDelta: number) => formatCostValue(absDelta, unit);

const tokenFormat = new Intl.NumberFormat('en-US');

export const formatTokenCount = (value?: number) => (value !== undefined ? tokenFormat.format(value) : '-');

/** Input plus output tokens. Undefined when neither is known. */
export const totalTokens = (usage?: { inputTokens?: number; outputTokens?: number }): number | undefined => {
  if (usage?.inputTokens === undefined && usage?.outputTokens === undefined) return undefined;
  return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
};
