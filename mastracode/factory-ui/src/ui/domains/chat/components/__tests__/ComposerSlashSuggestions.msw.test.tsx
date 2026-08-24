import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { Composer } from '../Composer';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

const COMMAND_NAMES = [
  'model',
  'goal',
  'goal-clear',
  'goal-pause',
  'goal-resume',
  'permissions',
  'yolo',
  'cost',
  'think',
  'om',
  'settings',
  'login',
  'follow-up',
  'abort',
  'help',
];

function renderComposer() {
  return renderWithProviders(
    <OverlayTestProviders>
      <Composer />
    </OverlayTestProviders>,
  );
}

/** The input stays disabled until the controller connection is ready. */
async function findReadyInput(): Promise<HTMLTextAreaElement> {
  const input = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
  await waitFor(() => expect(input).toBeEnabled());
  return input;
}

beforeEach(useOverlayControllerHandlers);

describe('Composer slash-command suggestions', () => {
  describe('when the user types "/" in the composer', () => {
    it('shows every registered slash command', async () => {
      const user = userEvent.setup();
      renderComposer();

      const input = await findReadyInput();
      await user.type(input, '/');

      for (const name of COMMAND_NAMES) {
        expect(await screen.findByRole('button', { name: new RegExp(`^/${name}\\s`) })).toBeInTheDocument();
      }
    });
  });

  describe('when the user narrows the command by typing', () => {
    it('filters suggestions by prefix and completes with Tab', async () => {
      const user = userEvent.setup();
      renderComposer();

      const input = await findReadyInput();
      await user.type(input, '/goa');

      expect(await screen.findByRole('button', { name: /^\/goal\s/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^\/help\s/ })).not.toBeInTheDocument();

      await user.keyboard('{Tab}');
      expect(input).toHaveValue('/goal ');
      // Args phase: suggestions close once the command is complete.
      expect(screen.queryByRole('button', { name: /^\/goal\s/ })).not.toBeInTheDocument();
    });
  });
});
