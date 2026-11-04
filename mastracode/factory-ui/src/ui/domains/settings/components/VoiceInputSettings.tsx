import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/components/Toaster';

import { useUpdateVoiceSettings, useVoiceSettings } from '../../../../hooks/use-voice-settings';
import { SettingsSubsection } from './SettingsSubsection';

const AUTO = 'auto';

function optionValue(choice: { provider: string; model: string }): string {
  return `${choice.provider}/${choice.model}`;
}

export function VoiceInputSettings() {
  const settingsQuery = useVoiceSettings();
  const update = useUpdateVoiceSettings();
  const settings = settingsQuery.data;
  const selected = settings?.selected ?? null;
  // A saved model stays listed after its key is removed, so the picker can show what dictation will try.
  const options = settings?.models.filter(m => m.available || (selected && optionValue(m) === optionValue(selected)));
  const current = selected ? options?.find(m => optionValue(m) === optionValue(selected)) : undefined;

  const pick = (value: string) => {
    const choice = value === AUTO ? null : options?.find(m => optionValue(m) === value);
    if (choice === undefined) return;
    update.mutate(choice && { provider: choice.provider, model: choice.model }, {
      onError: error => toast.error(`Failed to update voice input: ${error.message}`),
    });
  };

  return (
    <SettingsSubsection
      scope="personal"
      title="Voice input"
      description="Speech-to-text model for the composer mic. Uses your provider API keys; add one in Models to unlock more options."
    >
      <SettingsContainer>
        <SettingsRow
          label="Transcription model"
          description={
            options && options.length === 0
              ? 'No speech-to-text key yet. Add an OpenAI, Mistral, or Groq key to dictate.'
              : 'Auto uses the first provider you have a key for'
          }
        >
          <Select
            value={selected ? optionValue(selected) : AUTO}
            disabled={!settings || update.isPending}
            onValueChange={pick}
          >
            <SelectTrigger size="sm" aria-label="Transcription model" className="w-64">
              {current ? current.label : 'Auto'}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>Auto</SelectItem>
              {options?.map(m => (
                <SelectItem key={optionValue(m)} value={optionValue(m)}>
                  {m.available ? m.label : `${m.label} (no key)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsContainer>
    </SettingsSubsection>
  );
}
