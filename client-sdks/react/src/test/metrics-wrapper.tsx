import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { TEST_BASE_URL } from './render';
import { useMetricsQueryFilters } from '@/hooks/metrics/metrics-query-filters';
import type {
  MetricsDatePreset,
  MetricsDateRange,
  MetricsDimensionalFilter,
  MetricsQueryFilters,
} from '@/hooks/metrics/metrics-query-filters';
import { MastraReactProvider } from '@/mastra-react-provider';

interface MetricsWrapperOptions {
  preset?: MetricsDatePreset;
  customRange?: MetricsDateRange;
  dimensionalFilter?: MetricsDimensionalFilter;
  queryClient?: QueryClient;
}

type FiltersInput = {
  preset: MetricsDatePreset;
  customRange?: MetricsDateRange;
  dimensionalFilter: MetricsDimensionalFilter;
};

const TestMetricsContext = createContext<FiltersInput | null>(null);

export function useTestMetricsFilters(): MetricsQueryFilters {
  const input = useContext(TestMetricsContext);
  if (!input) throw new Error('useTestMetricsFilters must be used inside makeMetricsWrapper');
  return useMetricsQueryFilters({
    datePreset: input.preset,
    customRange: input.customRange,
    dimensionalFilter: input.dimensionalFilter,
    dimensionalFilterKey: JSON.stringify(input.dimensionalFilter),
  });
}

export function makeMetricsWrapper({
  preset = '3d',
  customRange,
  dimensionalFilter = {},
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
}: MetricsWrapperOptions = {}) {
  const input: FiltersInput = { preset, customRange, dimensionalFilter };
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestMetricsContext.Provider value={input}>{children}</TestMetricsContext.Provider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
}
