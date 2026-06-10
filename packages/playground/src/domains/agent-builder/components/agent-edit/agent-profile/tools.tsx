import { useMemo, useState } from 'react';
import { useAllProviderTools } from '../../../../tool-providers/hooks/use-all-provider-tools';
import { useToolProviders } from '../../../../tool-providers/hooks/use-tool-providers';
import type { AgentTool } from '../../../types/agent-tool';
import { TwoPanePickerSkeleton } from './two-pane-picker-skeleton';
import { ToolGrid, ToolListEmptyState } from './tool-grid';
import { getEmptyStateDetails, getVisibleTools } from './tool-visibility';
import { ToolkitFilterPane } from './toolkit-filter-pane';
import { useProviderToolkitGroups } from './use-provider-toolkit-groups';
import { useToolSelection } from './use-tool-selection';
import { useToolkitSelection } from './use-toolkit-selection';

interface ToolsProps {
  editable?: boolean;
  availableAgentTools?: AgentTool[];
}

export const Tools = ({ editable = true, availableAgentTools = [] }: ToolsProps) => {
  const [search, setSearch] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);

  // Provider grouping + toolkit ids derive synchronously from the prefetched
  // tools; each provider section fetches its own toolkit display names lazily.
  const { builtIn, providers, allToolkitIds, isProvidersLoading } = useProviderToolkitGroups(availableAgentTools);

  const toolkits = useToolkitSelection(allToolkitIds);
  const { toggle } = useToolSelection();

  // Per-provider capability lookup so the toolkit pane knows whether multiple
  // connections per toolkit are allowed for a given provider.
  const providersQuery = useToolProviders();
  const multipleAllowedByProvider = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const provider of providersQuery.data?.providers ?? []) {
      map.set(provider.id, provider.capabilities?.multipleConnectionsPerToolkit ?? false);
    }
    return map;
  }, [providersQuery.data?.providers]);

  // Integration tools stream in asynchronously; while they may still arrive,
  // show the structural skeleton (mirroring the Models loading layout) instead
  // of flashing the "no tools" empty state.
  const { isLoading: isIntegrationToolsLoading } = useAllProviderTools();

  if (availableAgentTools.length === 0) {
    if (isIntegrationToolsLoading) {
      return <TwoPanePickerSkeleton testId="tools-card-picker-loading" />;
    }
    return (
      <div className="px-6 py-6" data-testid="tools-empty-state">
        <ToolListEmptyState details={'No tools available in this project'} />
      </div>
    );
  }

  const visibleTools = getVisibleTools(availableAgentTools, search, onlySelected, toolkits.selected);
  const emptyStateDetails = getEmptyStateDetails({
    allToolkitsUnchecked: toolkits.allUnchecked,
    onlySelected,
    search,
  });

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)]" data-testid="tools-card-picker">
      {(isProvidersLoading || allToolkitIds.length > 0) && (
        <ToolkitFilterPane
          builtIn={builtIn}
          providers={providers}
          isProvidersLoading={isProvidersLoading}
          isChecked={toolkits.isChecked}
          onToggle={toolkits.toggle}
          onSelectAll={toolkits.selectAll}
          onClearAll={toolkits.clearAll}
          disabled={!editable}
          multipleAllowedByProvider={multipleAllowedByProvider}
        />
      )}

      <ToolGrid
        tools={visibleTools}
        editable={editable}
        onlySelected={onlySelected}
        onOnlySelectedChange={setOnlySelected}
        onSearch={setSearch}
        emptyStateDetails={emptyStateDetails}
        onToggle={toggle}
      />
    </div>
  );
};
