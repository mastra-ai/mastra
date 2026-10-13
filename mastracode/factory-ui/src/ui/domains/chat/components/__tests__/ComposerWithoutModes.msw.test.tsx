import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

function serverStillListsModes() {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/modes`, () =>
      HttpResponse.json({
        modes: [
          { id: 'build', name: 'Build' },
          { id: 'plan', name: 'Plan' },
        ],
      }),
    ),
  );
}

async function renderReadyThread() {
  const session = stubPreparingSession({ materialized: true });
  serverStillListsModes();
  const rendered = renderThread();
  await releaseSession(session.finishWorkspace, rendered.client);
  const message = await screen.findByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(message).toBeEnabled());
  return { session, message, ...rendered };
}

describe('Factory composer without modes', () => {
  it('given a ready session, when the status line renders, then it offers no mode picker', async () => {
    await renderReadyThread();

    expect(await screen.findByLabelText('Session model')).toBeInTheDocument();
    expect(screen.queryByLabelText('Session mode')).not.toBeInTheDocument();
  });

  it('given a ready session, when Shift+Tab is pressed in the composer, then no mode switch is sent', async () => {
    const { session, message, client } = await renderReadyThread();
    const user = userEvent.setup();

    await user.click(message);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitForMutationsIdle(client);

    expect(session.operations.filter(operation => operation.startsWith('mode:'))).toEqual([]);
  });

  it('given a ready session, when /settings runs, then the session summary has no mode line', async () => {
    const { message } = await renderReadyThread();
    const user = userEvent.setup();

    await user.type(message, '/settings');
    await user.keyboard('{Enter}');

    const summary = await screen.findByText(/Model: openai\/gpt-4o-mini/);
    expect(summary).not.toHaveTextContent('Mode:');
  });
});
