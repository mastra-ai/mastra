import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { PropertyFilterCreator } from '@mastra/playground-ui/components/PropertyFilter';
import type { PropertyFilterField, PropertyFilterToken } from '@mastra/playground-ui/components/PropertyFilter';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { DateRangeSelector } from '@mastra/playground-ui/domains/metrics/components/date-range-selector';
import { useMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import {
  clearSavedMetricsFilters,
  loadMetricsFiltersFromStorage,
  saveMetricsFiltersToStorage,
} from '@mastra/playground-ui/domains/metrics/metrics-filters';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { MetricsAgentScopeContext } from '../context/metrics-agent-scope';
import { MetricsLayout } from './metrics-layout';
import { MetricsToolbar } from './metrics-toolbar';

type MetricsPageLayoutProps = {
  children: ReactNode;
  filterFields: PropertyFilterField[];
  isLoading?: boolean;
};

/** URL controls do not need storage access and remain usable on unsupported stores. */
export function MetricsPageLayout({ children, filterFields, isLoading = false }: MetricsPageLayoutProps) {
  const scope = useContext(MetricsAgentScopeContext);
  const visibleFields = scope
    ? filterFields.filter(field => field.id !== 'entityName' && field.id !== 'rootEntityType')
    : filterFields;
  const [searchParams] = useSearchParams();
  const { filterTokens, setFilterTokens } = useMetrics();
  const visibleTokens = scope
    ? filterTokens.filter(token => token.fieldId !== 'entityName' && token.fieldId !== 'rootEntityType')
    : filterTokens;
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
    <MetricsLayout
      actionRow={
        <>
          <ActionRow>
            <ActionRow.Start>
              {scope && <Txt variant="subheading">Agent metrics</Txt>}
              <DateRangeSelector />
              <PropertyFilterCreator
                fields={visibleFields}
                tokens={visibleTokens}
                onTokensChange={setFilterTokens}
                disabled={isLoading}
                onStartTextFilter={setAutoFocusFilterFieldId}
              />
            </ActionRow.Start>
          </ActionRow>

          <MetricsToolbar
            isLoading={isLoading}
            filterFields={visibleFields}
            filterTokens={visibleTokens}
            onFilterTokensChange={setFilterTokens}
            onClear={handleClear}
            onRemoveAll={() => setFilterTokens([])}
            onSave={scope ? undefined : handleSave}
            onRemoveSaved={!scope && hasSavedFilters ? handleRemoveSaved : undefined}
            autoFocusFilterFieldId={autoFocusFilterFieldId}
          />
        </>
      }
    >
      <h1 className="sr-only">Metrics</h1>
      {children}
    </MetricsLayout>
  );
}
