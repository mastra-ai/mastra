import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { FACTORY_ID, SESSION_ID, stubPreparingSession } from '../../components/__tests__/composer-session-test-fixture';
import { ChatSessionTestProvider } from '../ChatSessionTestProvider';
import { useChatModes } from '../useChatModes';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;

function readModeId(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'modeId' in body && typeof body.modeId === 'string') {
    return body.modeId;
  }
  return '';
}

function stubModeSession({ failSwitch = false }: { failSwitch?: boolean } = {}) {
  const session = stubPreparingSession({ materialized: true });
  session.finishWorkspace();
  let serverModeId = 'build';
  const modeSwitches: string[] = [];
  server.use(
    http.get(`${API}/modes`, () =>
      HttpResponse.json({
        modes: [
          { id: 'build', name: 'Build' },
          { id: 'plan', name: 'Plan' },
        ],
      }),
    ),
    http.get(`${API}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: serverModeId,
        modelId: 'openai/gpt-4o-mini',
        threadId: SESSION_ID,
      }),
    ),
    http.post(`${API}/sessions/:resourceId/mode`, async ({ request }) => {
      modeSwitches.push(readModeId(await request.json()));
      if (failSwitch) return HttpResponse.json({ message: 'Mode unavailable' }, { status: 500 });
      serverModeId = modeSwitches[modeSwitches.length - 1]!;
      return HttpResponse.json({ ok: true });
    }),
  );
  return { modeSwitches };
}

function ModeProbe() {
  const { activeModeId, setMode } = useChatModes();
  const [switchError, setSwitchError] = useState('');
  return (
    <>
      <output data-testid="active-mode">{activeModeId ?? 'none'}</output>
      <output data-testid="switch-error">{switchError}</output>
      <button
        onClick={() =>
          setMode('plan').catch((error: unknown) =>
            setSwitchError(error instanceof Error ? error.message : 'switch failed'),
          )
        }
      >
        switch-to-plan
      </button>
    </>
  );
}

function renderModes() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
              <ModeProbe />
            </ChatSessionTestProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('live chat modes', () => {
  it('keeps showing the new mode after a successful switch settles', async () => {
    const user = userEvent.setup();
    const { modeSwitches } = stubModeSession();
    const { client } = renderModes();

    await waitFor(() => expect(screen.getByTestId('active-mode')).toHaveTextContent('build'));

    await user.click(screen.getByRole('button', { name: 'switch-to-plan' }));
    await waitFor(() => expect(screen.getByTestId('active-mode')).toHaveTextContent('plan'));

    // once the mutation settles the display is server truth, not a local echo — it must not snap back
    await waitForMutationsIdle(client);
    expect(screen.getByTestId('active-mode')).toHaveTextContent('plan');
    expect(modeSwitches).toEqual(['plan']);
  });

  it('returns to the server mode when the switch fails', async () => {
    const user = userEvent.setup();
    stubModeSession({ failSwitch: true });
    const { client } = renderModes();

    await waitFor(() => expect(screen.getByTestId('active-mode')).toHaveTextContent('build'));

    await user.click(screen.getByRole('button', { name: 'switch-to-plan' }));
    await waitForMutationsIdle(client);

    expect(screen.getByTestId('switch-error')).not.toHaveTextContent(/^$/);
    expect(screen.getByTestId('active-mode')).toHaveTextContent('build');
  });
});
