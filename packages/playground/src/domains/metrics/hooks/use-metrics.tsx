import { differenceInDays, format } from 'date-fns';
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

const PRESET_DAYS: Record<string, number> = {
  '24h': 1,
  '3d': 3,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

export type DateRange = { from?: Date; to?: Date };
export type Comparator = 'is' | 'is not';
export type FilterGroup = { id: string; field: string; comparator: Comparator; values: string[] };

const ENV_PCTS: Record<string, number> = {
  'Studio Cloud': 42,
  Production: 31,
  Staging: 18,
  Dev: 7,
  'CI / Preview': 2,
};

function getMultiplier(preset: DatePreset, customRange: DateRange | undefined, filterGroups: FilterGroup[]): number {
  let dateMul = 1;
  if (preset !== 'custom') {
    dateMul = PRESET_DAYS[preset] ?? 1;
  } else if (customRange?.from && customRange?.to) {
    dateMul = Math.max(1, differenceInDays(customRange.to, customRange.from) + 1);
  }

  const envGroups = filterGroups.filter(g => g.field === 'Environment' && g.comparator === 'is');
  const envPct =
    envGroups.length === 0 ? 100 : envGroups.flatMap(g => g.values).reduce((s, v) => s + (ENV_PCTS[v] ?? 0), 0);

  return dateMul * (envPct / 100);
}

export const MetricsContext = createContext<{
  datePreset: DatePreset;
  setDatePreset: (v: DatePreset) => void;
  customRange: DateRange | undefined;
  setCustomRange: (v: DateRange | undefined) => void;
  dateRangeLabel: string;
  filterGroups: FilterGroup[];
  setFilterGroups: React.Dispatch<React.SetStateAction<FilterGroup[]>>;
  multiplier: number;
}>({
  datePreset: '24h',
  setDatePreset: () => {},
  customRange: undefined,
  setCustomRange: () => {},
  dateRangeLabel: 'Last 24 hours',
  filterGroups: [],
  setFilterGroups: () => {},
  multiplier: 1,
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
      return `${format(customRange.from, 'MMM d, yyyy')} \u2013 ${format(customRange.to, 'MMM d, yyyy')}`;
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
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  const dateRangeLabel = getDateRangeLabel(datePreset, customRange);
  const multiplier = getMultiplier(datePreset, customRange, filterGroups);

  // Sync from external source (e.g. URL) when initialPreset changes
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
        filterGroups,
        setFilterGroups,
        multiplier,
      }}
    >
      {children}
    </MetricsContext.Provider>
  );
}
