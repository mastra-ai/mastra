import { useState } from 'react';
import { DatasetExperiment } from '@mastra/client-js';
import { useLinkComponent } from '@/lib/framework';
import { DatasetExperimentsToolbar } from './dataset-experiments-toolbar';
import { DatasetExperimentsList } from './dataset-experiments-list';
import { Column, Columns } from '@/ds/components/Columns';

export interface DatasetExperimentsProps {
  experiments: DatasetExperiment[];
  isLoading: boolean;
  datasetId: string;
}

export function DatasetExperiments({ experiments, isLoading, datasetId }: DatasetExperimentsProps) {
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<string[]>([]);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const { navigate } = useLinkComponent();

  // Toggle experiment selection for comparison (max 2)
  const toggleExperimentSelection = (experimentId: string) => {
    setSelectedExperimentIds(prev => {
      if (prev.includes(experimentId)) {
        return prev.filter(id => id !== experimentId);
      }
      // Only allow selecting 2 experiments max - replace oldest if selecting 3rd
      if (prev.length >= 2) {
        return [prev[1], experimentId];
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
          hasExperiments={experiments.length > 0}
          onCompareClick={() => setIsSelectionActive(true)}
          isSelectionActive={isSelectionActive}
          selectedCount={selectedExperimentIds.length}
          onExecuteCompare={handleCompare}
          onCancelSelection={handleCancelSelection}
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
