import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';

import type { VoiceChoice } from '../../../../../api/types';
import type { VoiceModel } from '../../../../../hooks/use-voice-settings';

const UNSET = 'unset';

export function voiceOptionValue(choice: VoiceChoice): string {
  return `${choice.provider}/${choice.model}`;
}

export function voiceModelLabel(models: VoiceModel[], choice: VoiceChoice | undefined): string | undefined {
  if (!choice) return undefined;
  return models.find(m => voiceOptionValue(m) === voiceOptionValue(choice))?.label;
}

/** A saved model stays listed after its key is removed, so the picker shows what voice input will try. */
export function offeredVoiceModels(
  models: VoiceModel[],
  hasKey: (model: VoiceModel) => boolean,
  selected: VoiceChoice | undefined,
): VoiceModel[] {
  return models.filter(
    model => hasKey(model) || (selected !== undefined && voiceOptionValue(model) === voiceOptionValue(selected)),
  );
}

export function VoiceModelPicker({
  label,
  unsetLabel,
  selected,
  models,
  hasKey,
  disabled,
  onPick,
}: {
  label: string;
  unsetLabel: string;
  selected?: VoiceChoice;
  models: VoiceModel[];
  hasKey: (model: VoiceModel) => boolean;
  disabled: boolean;
  onPick: (choice?: VoiceChoice) => void;
}) {
  const options = offeredVoiceModels(models, hasKey, selected);
  const pick = (value: string) => {
    const model = options.find(m => voiceOptionValue(m) === value);
    onPick(model && { provider: model.provider, model: model.model });
  };
  return (
    <Select value={selected ? voiceOptionValue(selected) : UNSET} disabled={disabled} onValueChange={pick}>
      <SelectTrigger size="sm" aria-label={label} className="w-64">
        {voiceModelLabel(models, selected) ?? unsetLabel}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>{unsetLabel}</SelectItem>
        {options.map(m => (
          <SelectItem key={voiceOptionValue(m)} value={voiceOptionValue(m)}>
            {hasKey(m) ? m.label : `${m.label} (no key)`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
