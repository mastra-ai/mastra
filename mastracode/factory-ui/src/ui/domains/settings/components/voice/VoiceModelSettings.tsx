import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import type { VoiceChoice, VoiceSettingsResponse } from '../../../../../api/types';
import { useUpdateVoiceSettings } from '../../../../../hooks/use-voice-settings';
import type { VoiceModel } from '../../../../../hooks/use-voice-settings';

const AUTO = 'auto';
const AUTO_LABEL = 'Auto';

const MODEL_ROW: Record<VoiceSettingsResponse['scope'], { label: string; picker: string; noKey: string }> = {
  factory: {
    label: 'Factory model',
    picker: 'Factory voice model',
    noKey: 'Add an organization speech-to-text key below to pick a model',
  },
  user: {
    label: 'Your model',
    picker: 'Your voice model',
    noKey: 'Add a speech-to-text key below to pick a model',
  },
};

const READ_ONLY_HINT = 'Only organization admins can change the Factory model';
const AUTO_HINT = 'Auto uses the first provider with a key';

function voiceOptionValue(choice: VoiceChoice): string {
  return `${choice.provider}/${choice.model}`;
}

function voiceModelLabel(models: VoiceModel[], choice: VoiceChoice | null): string | undefined {
  if (choice === null) return undefined;
  return models.find(m => voiceOptionValue(m) === voiceOptionValue(choice))?.label;
}

function modelHint(settings: VoiceSettingsResponse, needsKey: boolean): string {
  if (!settings.canEdit) return READ_ONLY_HINT;
  return needsKey ? MODEL_ROW[settings.scope].noKey : AUTO_HINT;
}

function inUseLabel(settings: VoiceSettingsResponse): string {
  const effective = voiceModelLabel(settings.models, settings.effective);
  if (effective) return effective;
  if (settings.selected !== null) return `Needs a ${providerDisplayName(settings.selected.provider)} key`;
  return 'No speech-to-text key yet';
}

export function VoiceModelSettings({ factoryId, settings }: { factoryId: string; settings: VoiceSettingsResponse }) {
  const update = useUpdateVoiceSettings(factoryId);
  const { selected, models } = settings;
  const keyed = new Set(settings.keys.filter(k => k.saved).map(k => k.provider));
  const hasKey = (m: VoiceModel) => keyed.has(m.provider);
  const selectedValue = selected === null ? AUTO : voiceOptionValue(selected);
  // A saved model stays listed after its key is removed, so the picker shows what voice input will try.
  const options = models.filter(m => hasKey(m) || voiceOptionValue(m) === selectedValue);
  const needsKey = options.length === 0;
  const row = MODEL_ROW[settings.scope];

  const pick = (value: string) => {
    const model = options.find(m => voiceOptionValue(m) === value);
    update.mutate(model ? { provider: model.provider, model: model.model } : null, {
      onError: error => toast.error(`Failed to update voice input: ${error.message}`),
    });
  };

  return (
    <SettingsContainer>
      <SettingsRow label={row.label} description={modelHint(settings, needsKey)}>
        <Select value={selectedValue} disabled={!settings.canEdit || needsKey || update.isPending} onValueChange={pick}>
          <SelectTrigger size="sm" aria-label={row.picker}>
            {voiceModelLabel(models, selected) ?? AUTO_LABEL}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>{AUTO_LABEL}</SelectItem>
            {options.map(m => (
              <SelectItem key={voiceOptionValue(m)} value={voiceOptionValue(m)}>
                {hasKey(m) ? m.label : `${m.label} (no key)`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsRow label="In use for you" description="What the mic uses right now">
        <Txt as="span" variant="caption">
          {inUseLabel(settings)}
        </Txt>
      </SettingsRow>
    </SettingsContainer>
  );
}
