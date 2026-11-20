import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import type { VoiceChoice, VoiceSettingsResponse } from '../../../../../api/types';
import { GATEWAY_VOICE_PROVIDER, useUpdateVoiceSettings } from '../../../../../hooks/use-voice-settings';
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

function modelHint(settings: VoiceSettingsResponse, needsKey: boolean, gatewayAvailable: boolean): string {
  if (!settings.canEdit) return READ_ONLY_HINT;
  if (gatewayAvailable) return 'Mastra Gateway is the preferred speech-to-text connection. Auto uses Gateway.';
  return needsKey ? MODEL_ROW[settings.scope].noKey : AUTO_HINT;
}

function inUseLabel(settings: VoiceSettingsResponse, gatewayModels: readonly { id: string }[]): string {
  const selected = settings.selected;
  if (selected?.provider === GATEWAY_VOICE_PROVIDER && gatewayModels.some(model => model.id === selected.model)) {
    return `Mastra Gateway: ${selected.model}`;
  }
  if ((!selected || selected.provider === GATEWAY_VOICE_PROVIDER) && gatewayModels[0]) {
    return `Mastra Gateway: ${gatewayModels[0].id}`;
  }
  const effective = voiceModelLabel(settings.models, settings.effective);
  if (effective) return effective;
  if (selected !== null && selected.provider !== GATEWAY_VOICE_PROVIDER)
    return `Needs a ${providerDisplayName(selected.provider)} key`;
  return 'No speech-to-text key yet';
}

export function VoiceModelSettings({
  factoryId,
  settings,
  gatewayModels = [],
}: {
  factoryId: string;
  settings: VoiceSettingsResponse;
  gatewayModels?: readonly { id: string }[];
}) {
  const update = useUpdateVoiceSettings(factoryId);
  const { selected, models } = settings;
  const keyed = new Set(settings.keys.filter(k => k.saved).map(k => k.provider));
  const hasKey = (m: VoiceModel) => keyed.has(m.provider);
  const gatewayChoices: VoiceModel[] = gatewayModels.map(model => ({
    provider: GATEWAY_VOICE_PROVIDER,
    model: model.id,
    label: `Mastra Gateway: ${model.id}`,
  }));
  const selectedValue = selected === null ? AUTO : voiceOptionValue(selected);
  // A saved model stays listed after its key is removed, so the picker shows what voice input will try.
  const options = [...gatewayChoices, ...models.filter(m => hasKey(m) || voiceOptionValue(m) === selectedValue)];
  const needsKey = options.length === 0;
  const row = MODEL_ROW[settings.scope];
  const shownValue = options.some(option => voiceOptionValue(option) === selectedValue) ? selectedValue : AUTO;

  const pick = (value: string) => {
    const model = options.find(m => voiceOptionValue(m) === value);
    update.mutate(model ? { provider: model.provider, model: model.model } : null, {
      onError: error => toast.error(`Failed to update voice input: ${error.message}`),
    });
  };

  return (
    <SettingsContainer>
      <SettingsRow label={row.label} description={modelHint(settings, needsKey, gatewayModels.length > 0)}>
        <Select value={shownValue} disabled={!settings.canEdit || needsKey || update.isPending} onValueChange={pick}>
          <SelectTrigger size="sm" aria-label={row.picker}>
            {options.find(option => voiceOptionValue(option) === shownValue)?.label ?? AUTO_LABEL}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>{AUTO_LABEL}</SelectItem>
            {options.map(m => (
              <SelectItem key={voiceOptionValue(m)} value={voiceOptionValue(m)}>
                {m.provider === GATEWAY_VOICE_PROVIDER || hasKey(m) ? m.label : `${m.label} (no key)`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsRow label="In use for you" description="What the mic uses right now">
        <Txt as="span" variant="caption">
          {inUseLabel(settings, gatewayModels)}
        </Txt>
      </SettingsRow>
    </SettingsContainer>
  );
}
