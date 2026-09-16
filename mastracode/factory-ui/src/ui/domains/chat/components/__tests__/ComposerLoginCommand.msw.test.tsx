import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { Composer } from '../Composer';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

beforeEach(useOverlayControllerHandlers);

describe('provider connection commands', () => {
  it.each(['/connect', '/login'])('%s takes the user to provider settings', async command => {
    const user = userEvent.setup();
    renderWithProviders(
      <OverlayTestProviders>
        <Composer />
      </OverlayTestProviders>,
    );

    const input = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, `${command}{Enter}`);

    const navigated = await screen.findByTestId('navigated-path');
    expect(navigated).toHaveTextContent(/\/settings\/models$/);
    expect(navigated).toHaveAttribute('data-return-to', expect.stringContaining('/threads/thread-test'));
  });
});
