'use client';

import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
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
      <Field orientation="horizontal" className="items-center">
        <Switch checked={overrideEnabled} onCheckedChange={onOverrideEnabledChange} disabled={disabled} />
        <FieldLabel>Override dataset scorers</FieldLabel>
      </Field>
      <p className="text-caption text-muted-foreground">
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
