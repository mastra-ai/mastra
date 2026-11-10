import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';
import { z } from 'zod';

/** Toggleable metrics of the compare page. Scorers use `scorer:<id>`. */
export type CompareMetricKey = 'cost' | 'duration' | 'average' | 'tokens' | 'errors' | `scorer:${string}`;

// Summary rows and item rows name the same metric differently.
const METRIC_KEY_BY_ID: Record<string, CompareMetricKey> = {
  cost: 'cost',
  'total-cost': 'cost',
  duration: 'duration',
  'avg-duration': 'duration',
  'avg-score': 'average',
  tokens: 'tokens',
  'total-tokens': 'tokens',
  errors: 'errors',
};

/** The picker key of a rendered metric id, or undefined for lines that are always shown (target, version…). */
function compareMetricKey(metricId: string): CompareMetricKey | undefined {
  if (metricId.startsWith('scorer:')) return metricId as CompareMetricKey;
  return METRIC_KEY_BY_ID[metricId];
}

const EMPTY: string[] = [];

// Module-level so the header picker and the grid read the same value without prop drilling.
const hiddenMetricsStore = createLocalStorageStore<string[]>({
  key: 'mastra:experiments-compare:hidden-metrics',
  defaultValue: EMPTY,
  parse: stored => z.array(z.string()).parse(stored),
});

export function useCompareMetricPreferences() {
  const hidden = useLocalStorageStore(hiddenMetricsStore);

  const isHidden = (key: CompareMetricKey) => hidden.includes(key);
  const isMetricVisible = (metricId: string) => {
    const key = compareMetricKey(metricId);
    return key === undefined || !hidden.includes(key);
  };
  const toggle = (key: CompareMetricKey) =>
    hiddenMetricsStore.write(hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key]);
  const reset = () => hiddenMetricsStore.write(EMPTY);

  return { isHidden, isMetricVisible, toggle, reset };
}
