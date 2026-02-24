import { useState, useMemo } from 'react';
import { DatasetExperiment } from '@mastra/client-js';
import { useLinkComponent } from '@/lib/framework';
import { DatasetExperimentsToolbar } from './dataset-experiments-toolbar';
import { DatasetExperimentsList } from './dataset-experiments-list';
import { Column, Columns } from '@/ds/components/Columns';
import type { DatasetExperimentsFilters } from '../../hooks/use-dataset-experiments';

export interface DatasetExperimentsProps {
  experiments: DatasetExperiment[];
  /** All experiments before filtering, used to derive target ID options */
  allExperiments?: DatasetExperiment[];
  isLoading: boolean;
  datasetId: string;
  filters: DatasetExperimentsFilters;
  onFiltersChange: (filters: DatasetExperimentsFilters) => void;
}

export function DatasetExperiments({
  experiments,
  allExperiments,
  isLoading,
  datasetId,
  filters,
  onFiltersChange,
}: DatasetExperimentsProps) {
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<string[]>([]);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const { navigate } = useLinkComponent();

  // Derive unique target IDs from all (unfiltered) experiments for the filter dropdown
  const targetIds = useMemo(() => {
    const source = allExperiments ?? experiments;
    return [...new Set(source.map(e => e.targetId))];
  }, [allExperiments, experiments]);

  // Toggle experiment selection for comparison (max 2)
  const toggleExperimentSelection = (experimentId: string) => {
    setSelectedExperimentIds(prev => {
      if (prev.includes(experimentId)) {
        return prev.filter(id => id !== experimentId);
      }
      // Only allow selecting 2 experiments max - keep oldest, replace most recent
      if (prev.length >= 2) {
        return [prev[0], experimentId];
      }
      return [...prev, experimentId];
    });
  };

  // Navigate to comparison view
  const handleCompare = () => {
    if (selectedExperimentIds.length === 2) {
      const [experimentIdA, experimentIdB] = selectedExperimentIds;
      navigate(`/datasets/${datasetId}/compare?experimentA=${experimentIdA}&experimentB=${experimentIdB}`);
    }
  };

  const handleCancelSelection = () => {
    setSelectedExperimentIds([]);
    setIsSelectionActive(false);
  };

  const handleRowClick = (experimentId: string) => {
    navigate(`/datasets/${datasetId}/experiments/${experimentId}`);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Columns>
      <Column>
        <DatasetExperimentsToolbar
          hasExperiments={experiments.length > 0 || Object.values(filters).some(Boolean)}
          onCompareClick={() => setIsSelectionActive(true)}
          isSelectionActive={isSelectionActive}
          selectedCount={selectedExperimentIds.length}
          onExecuteCompare={handleCompare}
          onCancelSelection={handleCancelSelection}
          filters={filters}
          onFiltersChange={onFiltersChange}
          targetIds={targetIds}
        />

        <DatasetExperimentsList
          experiments={experiments}
          isSelectionActive={isSelectionActive}
          selectedExperimentIds={selectedExperimentIds}
          onRowClick={handleRowClick}
          onToggleSelection={toggleExperimentSelection}
        />
      </Column>
    </Columns>
  );
}
