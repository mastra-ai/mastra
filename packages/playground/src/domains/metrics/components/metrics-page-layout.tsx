import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PropertyFilterCreator } from '@mastra/playground-ui/components/PropertyFilter';
import type { PropertyFilterField, PropertyFilterToken } from '@mastra/playground-ui/components/PropertyFilter';
import { DateRangeSelector } from '@mastra/playground-ui/domains/metrics/components/date-range-selector';
import { useMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import {
  clearSavedMetricsFilters,
  loadMetricsFiltersFromStorage,
  saveMetricsFiltersToStorage,
} from '@mastra/playground-ui/domains/metrics/metrics-filters';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { metricsCrumbs } from '../metrics-crumbs';
import { MetricsToolbar } from './metrics-toolbar';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

type MetricsPageLayoutProps = {
  children: ReactNode;
  filterFields: PropertyFilterField[];
  isLoading?: boolean;
};

/** URL controls do not need storage access and remain usable on unsupported stores. */
export function MetricsPageLayout({ children, filterFields, isLoading = false }: MetricsPageLayoutProps) {
  const [searchParams] = useSearchParams();
  const { filterTokens, setFilterTokens } = useMetrics();
  const [autoFocusFilterFieldId, setAutoFocusFilterFieldId] = useState<string | undefined>();
  const [hasSavedFilters, setHasSavedFilters] = useState(() => Boolean(loadMetricsFiltersFromStorage()));

  const handleSave = () => {
    saveMetricsFiltersToStorage(searchParams);
    setHasSavedFilters(true);
    toast.success('Filters setting for Metrics saved');
  };

  const handleRemoveSaved = () => {
    clearSavedMetricsFilters();
    setHasSavedFilters(false);
    toast.success('Filters setting for Metrics cleared up');
  };

  const handleClear = () => {
    const neutralTokens: PropertyFilterToken[] = filterTokens.map(token => {
      const field = filterFields.find(f => f.id === token.fieldId);
      if (!field) return token;
      if (field.kind === 'text') return { fieldId: token.fieldId, value: '' };
      if (field.kind === 'pick-multi') {
        return field.multi ? { fieldId: token.fieldId, value: [] } : { fieldId: token.fieldId, value: 'Any' };
      }
      if (field.kind === 'multi-select') return { fieldId: token.fieldId, value: [] };
      return token;
    });
    setFilterTokens(neutralTokens);
  };

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={metricsCrumbs} />}
      className="grid grid-rows-[auto_minmax(0,1fr)] p-4"
    >
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column className="flex flex-wrap items-start justify-start gap-2">
            <DateRangeSelector />
            <PropertyFilterCreator
              fields={filterFields}
              tokens={filterTokens}
              onTokensChange={setFilterTokens}
              disabled={isLoading}
              onStartTextFilter={setAutoFocusFilterFieldId}
            />
          </PageLayout.Column>
        </PageLayout.Row>

        <MetricsToolbar
          isLoading={isLoading}
          filterFields={filterFields}
          filterTokens={filterTokens}
          onFilterTokensChange={setFilterTokens}
          onClear={handleClear}
          onRemoveAll={() => setFilterTokens([])}
          onSave={handleSave}
          onRemoveSaved={hasSavedFilters ? handleRemoveSaved : undefined}
          autoFocusFilterFieldId={autoFocusFilterFieldId}
        />
      </PageLayout.TopArea>
      {children}
    </PageLayout>
  );
}
