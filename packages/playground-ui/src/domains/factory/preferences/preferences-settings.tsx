import { useState } from 'react';
import { loadDoneSound, playDoneSound, saveDoneSound } from './done-sound';

import type { DoneSound } from './done-sound';
import { SettingsSubsection } from './settings-subsection';
import { SoundPicker } from './sound-picker';

import { ThemeToggle } from '@/ds/components/ThemeToggle';
import { SettingsContainer, SettingsRow } from '@/ds/new/settings';

export function PreferencesSettings() {
  const [doneSound, setDoneSound] = useState<DoneSound>(() => loadDoneSound());
  const changeDoneSound = (next: DoneSound) => {
    setDoneSound(next);
    saveDoneSound(next);

    playDoneSound(next);
  };
  return (
    <SettingsSubsection scope="personal" title="Preferences" description="Stored in this browser.">
      <SettingsContainer>
        <SettingsRow label="Theme" description="Color scheme for the interface.">
          <ThemeToggle />
        </SettingsRow>
        <SettingsRow label="Completion sound" description="Played when an agent run finishes.">
          <SoundPicker value={doneSound} onChange={changeDoneSound} />
        </SettingsRow>
      </SettingsContainer>
    </SettingsSubsection>
  );
}
