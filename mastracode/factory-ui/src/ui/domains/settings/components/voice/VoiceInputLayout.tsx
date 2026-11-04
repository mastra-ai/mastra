import type { ReactNode } from 'react';

import { VOICE_INPUT_ANCHOR } from '../../settingsSections';
import { SettingsSubsection } from '../SettingsSubsection';

/** Positions the voice model rows above the speech-to-text keys they depend on. */
export function VoiceInputLayout({
  models,
  keys,
  keysScope,
}: {
  models: ReactNode;
  keys: ReactNode;
  keysScope: 'personal' | 'org';
}) {
  return (
    <div className="flex flex-col gap-8">
      <SettingsSubsection
        id={VOICE_INPUT_ANCHOR}
        scope="factory"
        title="Voice input"
        description="Speech-to-text model for the composer mic and Slack voice clips in this Factory."
      >
        {models}
      </SettingsSubsection>
      <SettingsSubsection
        scope={keysScope}
        title="Speech-to-text keys"
        description="Voice input uses the same provider keys as chat models."
      >
        {keys}
      </SettingsSubsection>
    </div>
  );
}
