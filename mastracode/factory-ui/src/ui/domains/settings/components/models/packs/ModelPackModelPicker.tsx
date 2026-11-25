import { DEFAULT_THINKING_LEVEL } from '@mastra/factory/default-thinking-level';
import { MODEL_ID_PATTERN } from '@mastra/factory/model-packs';
import type { ModelPackModel } from '@mastra/factory/model-packs';
import { ThinkingLevelRamp } from '@mastra/playground-ui/components/ThinkingLevel';
import { ModelPicker } from '@mastra/playground-ui/domains/llm';
import type { ModelPickerValue } from '@mastra/playground-ui/domains/llm';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { useState } from 'react';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { catalogModelPickerValue, findPickerModel, modelPickerProviders } from '../../../../../lib/modelPickerCatalog';
import { ALL_THINKING_LEVEL_OPTIONS, THINKING_LEVEL_LABELS } from '../../../../chat/services/thinkingLevels';
import { ModelPackEntryLabel, renderPackProviderIcon } from './ModelPackEntryLabel';

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

  return (
    <ModelPicker
      providers={modelPickerProviders(
        models.filter(model => model.id === entry?.modelId || !occupiedIds.has(model.id)),
      )}
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
