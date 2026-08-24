import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { Composer } from '../Composer';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

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
    it('shows the resolved built-in registry', async () => {
      const user = userEvent.setup();
      renderComposer();

      const input = await findReadyInput();
      await user.type(input, '/');

      for (const invocation of ['/goal', '/models', '/cost', '/think', '/help']) {
        expect(
          await screen.findByRole('button', { name: new RegExp(`^${invocation.replace('/', '\\/')}\\s`) }),
        ).toBeInTheDocument();
      }
    });

    it('renders runtime invocations verbatim without prepending a slash', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/discover`, () =>
          HttpResponse.json({
            capabilities: { customCommands: 'supported', skills: 'supported' },
            commands: [
              {
                command: '//review',
                source: 'custom',
                name: 'review',
                description: 'Review the working tree',
                goal: false,
              },
            ],
          }),
        ),
      );
      const user = userEvent.setup();
      renderComposer();

      const input = await findReadyInput();
      await user.type(input, '//rev');

      expect(await screen.findByRole('button', { name: /\/\/review/ })).toBeInTheDocument();

      await user.keyboard('{Tab}');
      // The exact `//name` token is inserted verbatim — no slash is stripped
      // or prepended.
      expect(input).toHaveValue('//review ');
    });
  });

  describe('when the user narrows the command by typing', () => {
    it('filters suggestions by prefix and completes with the exact invocation', async () => {
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
