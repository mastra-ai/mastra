'use client';

import { Label } from '@mastra/playground-ui/components/Label';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { ScorerSelector } from '../experiment-trigger/scorer-selector';

export interface DatasetItemScorerSelectorProps {
  overrideEnabled: boolean;
  onOverrideEnabledChange: (enabled: boolean) => void;
  selectedScorerIds: string[];
  onSelectedScorerIdsChange: (scorerIds: string[]) => void;
  disabled?: boolean;
}

export function DatasetItemScorerSelector({
  overrideEnabled,
  onOverrideEnabledChange,
  selectedScorerIds,
  onSelectedScorerIdsChange,
  disabled = false,
}: DatasetItemScorerSelectorProps) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <Switch
          id="override-dataset-scorers"
          checked={overrideEnabled}
          onCheckedChange={onOverrideEnabledChange}
          disabled={disabled}
        />
        <Label htmlFor="override-dataset-scorers">Override dataset scorers</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        {overrideEnabled
          ? 'Only selected scorers run for this item. Leave empty to run no scorers.'
          : 'Use scorers attached to the dataset.'}
      </p>
      {overrideEnabled ? (
        <ScorerSelector
          selectedScorers={selectedScorerIds}
          setSelectedScorers={onSelectedScorerIdsChange}
          disabled={disabled}
          label="Item scorers"
          helperText="Choose from scorers that can be resolved by this Mastra instance."
        />
      ) : null}
    </div>
  );
}
