import type { ReactElement } from 'react';

import { MetricsProvider } from '../hooks/use-metrics';
import type { DatePreset, DateRange } from '../hooks/use-metrics';
import type { PropertyFilterToken } from '@/ds/components/PropertyFilter/types';
import { renderWithProviders } from '@/test/render';

export interface MetricsRenderOptions {
  preset?: DatePreset;
  customRange?: DateRange;
  filterTokens?: PropertyFilterToken[];
}

const noop = () => {};

const withMetrics = (ui: ReactElement, { preset = '24h', customRange, filterTokens = [] }: MetricsRenderOptions) => (
  <MetricsProvider
    preset={preset}
    customRange={customRange}
    filterTokens={filterTokens}
    onPresetChange={noop}
    onFilterTokensChange={noop}
  >
    {ui}
  </MetricsProvider>
);

/** Renders a metrics card inside the real client + React Query + MetricsProvider stack. */
export const renderWithMetrics = (ui: ReactElement, options: MetricsRenderOptions = {}) => {
  const result = renderWithProviders(withMetrics(ui, options));
  return {
    ...result,
    rerenderWithMetrics: (next: MetricsRenderOptions) => result.rerender(withMetrics(ui, next)),
  };
};
