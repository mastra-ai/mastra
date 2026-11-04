import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { GeneralSettings } from '../SettingsPanel.parts';

describe('GeneralSettings', () => {
  it('switches the theme and remembers the choice', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GeneralSettings />);

    const theme = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(within(theme).getByRole('radio', { name: 'System' })).toBeChecked();
    await user.click(within(theme).getByRole('radio', { name: 'Dark' }));

    expect(window.localStorage.getItem('mastracode.theme')).toBe('dark');
    expect(within(theme).getByRole('radio', { name: 'Dark' })).toBeChecked();
  });
});
