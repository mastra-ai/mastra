import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../../context/ChatSessionContext';
import { ActiveModelPack } from '../ActiveModelPack';

const session: ChatSessionContextApi = {
  resourceId: 'session-1',
  sessionEnabled: true,
  resourceReady: true,
  sandboxReady: true,
  sandboxPreparing: false,
  sandboxProgress: undefined,
  resourceEnabled: true,
  projectPath: '/tmp/session-1',
  baseUrl: TEST_BASE_URL,
  kind: 'user',
};

const packs = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: '',
    models: { build: 'p/build', plan: 'p/plan', fast: 'p/fast' },
    custom: false,
    active: true,
  },
  {
    id: 'mine',
    name: 'Mine',
    description: '',
    models: { build: 'p/build-2', plan: 'p/plan-2', fast: 'p/fast-2' },
    custom: true,
    active: false,
  },
];

describe('ActiveModelPack', () => {
  it('applies a different pack only to the current chat', async () => {
    let sessionPackId = 'balanced';
    let listUrl = '';
    let activateBody: unknown;
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/model-packs`, ({ request }) => {
        listUrl = request.url;
        return HttpResponse.json({ packs, activePackId: 'balanced', sessionPackId });
      }),
      http.post(`${TEST_BASE_URL}/web/config/model-packs/mine/activate`, async ({ request }) => {
        activateBody = await request.json();
        sessionPackId = 'mine';
        return HttpResponse.json({ ok: true, target: 'session', sessionPackId: 'mine' });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <ChatSessionContext.Provider value={session}>
        <ChatConnectionContext.Provider value={{ status: 'ready' }}>
          <ActiveModelPack />
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>,
    );

    const trigger = await screen.findByLabelText('Thread model pack');
    expect(trigger).toHaveTextContent('Pack · Balanced');
    expect(new URL(listUrl).searchParams.get('resourceId')).toBe('session-1');
    expect(new URL(listUrl).searchParams.get('scope')).toBe('/tmp/session-1');

    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Mine' }));

    await waitFor(() =>
      expect(activateBody).toEqual({
        target: 'session',
        resourceId: 'session-1',
        scope: '/tmp/session-1',
      }),
    );
    await waitForMutationsIdle(client);
    expect(trigger).toHaveTextContent('Pack · Mine');
  });
});
