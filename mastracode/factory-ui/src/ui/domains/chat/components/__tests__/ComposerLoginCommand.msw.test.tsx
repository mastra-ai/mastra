import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { Composer } from '../Composer';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

beforeEach(useOverlayControllerHandlers);

async function runCommand(command: string) {
  const user = userEvent.setup();
  const { client } = renderWithProviders(
    <OverlayTestProviders>
      <Composer />
    </OverlayTestProviders>,
  );

  const input = await screen.findByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(input).toBeEnabled());
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await user.type(input, `${command}{Enter}`);
  return screen.findByTestId('navigated-path');
}

describe('provider connection commands', () => {
  it.each(['/connect', '/login'])('%s takes the user to their personal defaults', async command => {
    const navigated = await runCommand(command);

    expect(navigated).toHaveTextContent(/\/settings\/models#personal-defaults$/);
    expect(navigated).toHaveAttribute('data-return-to', expect.stringContaining('/threads/thread-test'));
  });

  it.each(['/connect', '/login'])('%s takes a Factory-routed session to the Factory defaults', async command => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: [], modelScope: 'factory' })),
    );

    const navigated = await runCommand(command);

    expect(navigated).toHaveTextContent(/\/settings\/models#factory-defaults$/);
  });
});
