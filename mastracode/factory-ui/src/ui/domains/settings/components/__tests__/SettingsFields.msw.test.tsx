import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { DoneSound } from '../../services/doneSound';
import { SoundPicker } from '../SettingsFields';

function SoundHarness() {
  const [sound, setSound] = useState<DoneSound>('fanfare');
  return <SoundPicker value={sound} onChange={setSound} />;
}

describe('SoundPicker', () => {
  describe('given a sound is picked and then muted', () => {
    it('holds on to the sound so unmuting brings it back', async () => {
      const user = userEvent.setup();
      render(<SoundHarness />);
      const sound = screen.getByRole('combobox', { name: 'Completion sound' });
      expect(sound).toHaveTextContent('Fanfare');

      await user.click(screen.getByRole('switch', { name: 'Play a sound' }));

      expect(sound).toBeDisabled();
      expect(sound).toHaveTextContent('Fanfare');

      await user.click(screen.getByRole('switch', { name: 'Play a sound' }));

      expect(sound).toBeEnabled();
      expect(sound).toHaveTextContent('Fanfare');
    });
  });
});
