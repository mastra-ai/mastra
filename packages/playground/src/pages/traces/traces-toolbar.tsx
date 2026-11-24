import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type {
  TracesExplorerCapabilities,
  TracesFilters,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { useTracesFilterSuggestionsQuery } from '@mastra/playground-ui/domains/traces/hooks/use-traces-filter-suggestions-query';
import { memo } from 'react';
import { STUDIO_TRACES_FEATURES } from './features';

type TracesToolbarProps = { filters: TracesFilters; capabilities: TracesExplorerCapabilities };

/** The filter bar, with Studio's suggestions, and the columns menu. Memoized: list refreshes leave it alone. */
export const TracesToolbar = memo(function TracesToolbar({ filters, capabilities }: TracesToolbarProps) {
  const suggestions = useTracesFilterSuggestionsQuery({ filters, capabilities, features: STUDIO_TRACES_FEATURES });
  return (
    <ActionRow>
      <ActionRow.Start>
        <TracesExplorer.FilterBar suggestions={suggestions} />
      </ActionRow.Start>
      <ActionRow.End>
        <TracesExplorer.ColumnsMenu />
      </ActionRow.End>
    </ActionRow>
  );
});
