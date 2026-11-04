import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { useUpdateVoiceSettings } from '../../../../../hooks/use-voice-settings';
import type { UpdateVoiceSettingsArgs, VoiceModel, VoiceSettings } from '../../../../../hooks/use-voice-settings';
import { VoiceModelPicker, voiceModelLabel } from './VoiceModelPicker';

const FACTORY_MODEL_HINT = {
  editable: 'Auto uses the first provider with a key',
  readOnly: 'Only organization admins can change the Factory model',
};

const PERSONAL_MODEL_HINT = {
  user: 'Transcribed with your personal keys',
  hybrid: 'Your personal key is tried first',
};

const IN_USE_HINT = {
  factory: 'This Factory transcribes with organization keys',
  member: 'What the mic uses right now',
};

/** The Factory's voice model, the caller's override (unless the Factory bills the org), and what applies now. */
export function VoiceModelSettings({ factoryId, settings }: { factoryId: string; settings: VoiceSettings }) {
  const update = useUpdateVoiceSettings(factoryId);
  const { modelScope, models } = settings;
  const orgKeys = new Set(settings.keys.filter(k => k.org).map(k => k.provider));
  const factoryHasKey = (m: VoiceModel) => (modelScope === 'user' ? m.available : orgKeys.has(m.provider));
  const factoryLabel = voiceModelLabel(models, settings.factory) ?? 'Auto';

  const save = (args: UpdateVoiceSettingsArgs) =>
    update.mutate(args, { onError: error => toast.error(`Failed to update voice input: ${error.message}`) });

  return (
    <SettingsContainer>
      <SettingsRow
        label="Factory model"
        description={settings.canEditFactory ? FACTORY_MODEL_HINT.editable : FACTORY_MODEL_HINT.readOnly}
      >
        <VoiceModelPicker
          label="Factory voice model"
          unsetLabel="Auto"
          selected={settings.factory}
          models={models}
          hasKey={factoryHasKey}
          disabled={!settings.canEditFactory || update.isPending}
          onPick={choice => save({ target: 'factory', choice })}
        />
      </SettingsRow>
      {modelScope !== 'factory' && (
        <SettingsRow label="Your model" description={PERSONAL_MODEL_HINT[modelScope]}>
          <VoiceModelPicker
            label="Your voice model"
            unsetLabel={`Use Factory's (${factoryLabel})`}
            selected={settings.personal}
            models={models}
            hasKey={m => m.available}
            disabled={update.isPending}
            onPick={choice => save({ target: 'personal', choice })}
          />
        </SettingsRow>
      )}
      <SettingsRow
        label="In use for you"
        description={modelScope === 'factory' ? IN_USE_HINT.factory : IN_USE_HINT.member}
      >
        <Txt as="span" variant="caption">
          {voiceModelLabel(models, settings.effective) ?? 'No speech-to-text key yet'}
        </Txt>
      </SettingsRow>
    </SettingsContainer>
  );
}
