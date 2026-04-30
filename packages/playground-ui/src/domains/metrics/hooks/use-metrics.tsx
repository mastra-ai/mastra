import { format } from 'date-fns';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

const DATE_PRESETS = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 3 days', value: '3d' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 14 days', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number]['value'] | 'custom';

export { DATE_PRESETS };

const VALID_PRESETS = new Set<string>(DATE_PRESETS.map(p => p.value));

export function isValidPreset(value: string | null | undefined): value is DatePreset {
  return typeof value === 'string' && (VALID_PRESETS.has(value) || value === 'custom');
}

export type DateRange = { from?: Date; to?: Date };

export const MetricsContext = createContext<{
  datePreset: DatePreset;
  setDatePreset: (v: DatePreset) => void;
  customRange: DateRange | undefined;
  setCustomRange: (v: DateRange | undefined) => void;
  dateRangeLabel: string;
}>({
  datePreset: '24h',
  setDatePreset: () => {},
  customRange: undefined,
  setCustomRange: () => {},
  dateRangeLabel: 'Last 24 hours',
});

export function useMetrics() {
  return useContext(MetricsContext);
}

function getDateRangeLabel(preset: DatePreset, customRange: DateRange | undefined) {
  if (preset !== 'custom') {
    return DATE_PRESETS.find(p => p.value === preset)!.label;
  }
  if (customRange?.from) {
    if (customRange.to) {
      return `${format(customRange.from, 'MMM d, yyyy')} – ${format(customRange.to, 'MMM d, yyyy')}`;
    }
    return format(customRange.from, 'MMM d, yyyy');
  }
  return 'Custom range';
}

export function MetricsProvider({
  children,
  initialPreset,
  onPresetChange,
}: {
  children: ReactNode;
  initialPreset?: DatePreset;
  onPresetChange?: (preset: DatePreset) => void;
}) {
  const [datePreset, setDatePresetState] = useState<DatePreset>(initialPreset ?? '24h');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const dateRangeLabel = getDateRangeLabel(datePreset, customRange);

  useEffect(() => {
    if (initialPreset && initialPreset !== datePreset) {
      setDatePresetState(initialPreset);
    }
  }, [initialPreset]);

  const setDatePreset = useCallback(
    (v: DatePreset) => {
      setDatePresetState(v);
      onPresetChange?.(v);
    },
    [onPresetChange],
  );

  return (
    <MetricsContext.Provider
      value={{
        datePreset,
        setDatePreset,
        customRange,
        setCustomRange,
        dateRangeLabel,
      }}
    >
      {children}
    </MetricsContext.Provider>
  );
}
