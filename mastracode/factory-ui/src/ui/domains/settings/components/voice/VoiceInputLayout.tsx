import type { ReactNode } from 'react';

import type { VoiceSettings } from '../../../../../hooks/use-voice-settings';
import { VOICE_INPUT_ANCHOR } from '../../settingsSections';
import type { SettingsScope } from '../SettingsScope';
import { SettingsSubsection } from '../SettingsSubsection';

type VoiceScope = VoiceSettings['scope'];

const MODEL_SCOPE: Record<VoiceScope, SettingsScope> = { factory: 'factory', user: 'personal' };
const KEYS_SCOPE: Record<VoiceScope, SettingsScope> = { factory: 'org', user: 'personal' };

const DESCRIPTION = 'Speech-to-text for the composer mic and Slack voice clips.';
const SCOPE_DESCRIPTION: Record<VoiceScope, string> = {
  factory: `${DESCRIPTION} Like chats in this Factory, it uses the Factory's model and organization keys.`,
  user: `${DESCRIPTION} Like chats in this Factory, it uses your own model and keys.`,
};

export function VoiceInputLayout({
  scope,
  models,
  keys,
}: {
  scope: VoiceScope | undefined;
  models: ReactNode;
  keys: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <SettingsSubsection
        id={VOICE_INPUT_ANCHOR}
        scope={scope && MODEL_SCOPE[scope]}
        title="Voice input"
        description={scope ? SCOPE_DESCRIPTION[scope] : DESCRIPTION}
      >
        {models}
      </SettingsSubsection>
      <SettingsSubsection
        scope={scope && KEYS_SCOPE[scope]}
        title="Speech-to-text keys"
        description="Voice input uses the same provider keys as chat models."
      >
        {keys}
      </SettingsSubsection>
    </div>
  );
}
