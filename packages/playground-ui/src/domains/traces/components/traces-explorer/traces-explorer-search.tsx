import { useTracesConfig, useTracesFilters } from './traces-explorer-context';
import { ObservabilityTextSearch } from '@/domains/observability/components/observability-text-search';

export function TracesExplorerSearch() {
  const { withTextSearch } = useTracesConfig();
  const { filters, setTextSearch } = useTracesFilters();
  if (!withTextSearch) return null;
  return (
    <ObservabilityTextSearch label="Search traces" value={filters.textSearch ?? ''} onValueChange={setTextSearch} />
  );
}
