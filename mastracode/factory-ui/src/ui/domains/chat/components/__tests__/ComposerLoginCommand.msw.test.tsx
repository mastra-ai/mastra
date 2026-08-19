import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { Composer } from '../Composer';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

beforeEach(useOverlayControllerHandlers);

describe('the /login command', () => {
  it('takes the user to the settings section where providers are connected', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <OverlayTestProviders>
        <Composer />
      </OverlayTestProviders>,
    );

    const input = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, '/login{Enter}');

    expect(await screen.findByTestId('navigated-path')).toHaveTextContent(/\/settings\/models$/);
  });
});
