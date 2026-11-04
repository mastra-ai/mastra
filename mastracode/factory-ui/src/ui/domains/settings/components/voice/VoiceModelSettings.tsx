import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { useUpdateVoiceSettings } from '../../../../../hooks/use-voice-settings';
import type { VoiceModel, VoiceSettings } from '../../../../../hooks/use-voice-settings';
import type { VoiceChoice } from '../../../../../api/types';
import { VoiceModelPicker, offeredVoiceModels, voiceModelLabel } from './VoiceModelPicker';

const MODEL_ROW: Record<VoiceSettings['scope'], { label: string; picker: string; noKey: string }> = {
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

function modelHint(settings: VoiceSettings, needsKey: boolean): string {
  if (!settings.canEdit) return READ_ONLY_HINT;
  return needsKey ? MODEL_ROW[settings.scope].noKey : AUTO_HINT;
}

export function VoiceModelSettings({ factoryId, settings }: { factoryId: string; settings: VoiceSettings }) {
  const update = useUpdateVoiceSettings(factoryId);
  const keyed = new Set(settings.keys.filter(k => k.saved).map(k => k.provider));
  const hasKey = (m: VoiceModel) => keyed.has(m.provider);
  const needsKey = offeredVoiceModels(settings.models, hasKey, settings.selected).length === 0;
  const row = MODEL_ROW[settings.scope];

  const save = (choice: VoiceChoice | undefined) =>
    update.mutate(choice, { onError: error => toast.error(`Failed to update voice input: ${error.message}`) });

  return (
    <SettingsContainer>
      <SettingsRow label={row.label} description={modelHint(settings, needsKey)}>
        <VoiceModelPicker
          label={row.picker}
          unsetLabel="Auto"
          selected={settings.selected}
          models={settings.models}
          hasKey={hasKey}
          disabled={!settings.canEdit || needsKey || update.isPending}
          onPick={save}
        />
      </SettingsRow>
      <SettingsRow label="In use for you" description="What the mic uses right now">
        <Txt as="span" variant="caption">
          {voiceModelLabel(settings.models, settings.effective) ?? 'No speech-to-text key yet'}
        </Txt>
      </SettingsRow>
    </SettingsContainer>
  );
}
