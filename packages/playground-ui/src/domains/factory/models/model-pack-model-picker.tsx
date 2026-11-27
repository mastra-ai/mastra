import { useMemo, useState } from 'react';
import { ModelPackEntryLabel } from './model-pack-entry-label';
import { DEFAULT_THINKING_LEVEL, MODEL_ID_PATTERN } from './model-packs';
import type { ModelPackModel, AvailableModelOption } from './model-packs';
import { catalogModelPickerValue, findPickerModel, modelPickerProviders } from './model-picker-catalog';
import { renderPackProviderIcon } from './render-pack-provider-icon';
import { ALL_THINKING_LEVEL_OPTIONS, THINKING_LEVEL_LABELS } from './thinking-levels';
import { ModelPicker } from '@/domains/llm';

import type { ModelPickerValue } from '@/domains/llm';
import { ThinkingLevelRamp } from '@/ds/components/ThinkingLevel';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { formatModelName } from '@/utils/model';

interface ModelPackModelPickerProps {
  label: string;
  entry?: ModelPackModel;
  models: readonly AvailableModelOption[];
  occupiedIds: ReadonlySet<string>;
  disabled: boolean;
  onChange: (entry: ModelPackModel) => void | Promise<unknown>;
}

function customPickerValue(modelId: string): ModelPickerValue {
  const slash = modelId.indexOf('/');
  return { provider: modelId.slice(0, slash), model: modelId.slice(slash + 1) };
}

export function ModelPackModelPicker({
  label,
  entry,
  models,
  occupiedIds,
  disabled,
  onChange,
}: ModelPackModelPickerProps) {
  const choice = entry && models.find(option => option.id === entry.modelId);
  const value = entry && (choice ? catalogModelPickerValue(choice) : customPickerValue(entry.modelId));
  const name = entry ? formatModelName(entry.modelId) : label;
  const [newModelThinkingLevel, setNewModelThinkingLevel] = useState(DEFAULT_THINKING_LEVEL);
  const thinkingLevel = entry?.thinkingLevel ?? newModelThinkingLevel;
  const options = ALL_THINKING_LEVEL_OPTIONS;
  const entryModelId = entry?.modelId;
  // A gateway catalog has thousands of models, and every pack row renders a picker.
  const providers = useMemo(
    () => modelPickerProviders(models.filter(model => model.id === entryModelId || !occupiedIds.has(model.id))),
    [models, occupiedIds, entryModelId],
  );

  return (
    <ModelPicker
      providers={providers}
      value={value}
      onValueChange={selection => {
        const modelId = findPickerModel(models, selection)?.id ?? `${selection.provider}/${selection.model}`;
        if (!disabled) void onChange({ modelId, thinkingLevel });
      }}
      customModel={modelId => {
        if (
          !MODEL_ID_PATTERN.test(modelId) ||
          occupiedIds.has(modelId) ||
          models.some(option => option.id === modelId)
        ) {
          return undefined;
        }
        return customPickerValue(modelId);
      }}
      busy={disabled}
      side="bottom"
      align="start"
      chevron={false}
      triggerClassName={entry ? 'w-full justify-start' : undefined}
      aria-label={entry ? `${label}: ${name}, thinking: ${THINKING_LEVEL_LABELS[thinkingLevel]}` : label}
      renderProviderIcon={renderPackProviderIcon}
      settings={
        <ThinkingLevelRamp
          options={options}
          value={thinkingLevel}
          label="Thinking"
          onChange={level => {
            if (disabled) return;
            if (!entry) return setNewModelThinkingLevel(level);
            return onChange({ ...entry, thinkingLevel: level });
          }}
        />
      }
    >
      {entry ? (
        <ModelPackEntryLabel entry={entry} />
      ) : (
        <>
          <IconPlusMedium aria-hidden className="size-icon-md shrink-0" />
          <span className="min-w-0 flex-1 truncate text-start">{label}</span>
        </>
      )}
    </ModelPicker>
  );
}
