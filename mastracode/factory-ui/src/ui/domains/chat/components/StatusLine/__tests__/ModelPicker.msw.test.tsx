import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import { ChatModelsProvider } from '../../../context/ChatModelsProvider';
import { ChatModesContext } from '../../../context/ChatModesContext';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../../context/ChatSessionContext';
import { AGENT_CONTROLLER_ID } from '../../../services/constants';
import { ModelPicker } from '../ModelPicker';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const API = `${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}`;
const models = [
  { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
];

const baseSession: ChatSessionContextApi = {
  resourceId: 'session-1',
  sessionEnabled: true,
  resourceReady: true,
  sandboxReady: true,
  sandboxPreparing: false,
  resourceEnabled: true,
  baseUrl: TEST_BASE_URL,
  kind: 'user',
};

function renderPicker({
  kind = 'user',
  modelId = 'openai/gpt-5',
  defaultModelId = 'anthropic/claude-sonnet-4-5',
}: {
  kind?: ChatSessionContextApi['kind'];
  modelId?: string;
  defaultModelId?: string | null;
} = {}) {
  const modelSwitches: string[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () => HttpResponse.json({ modelId: defaultModelId })),
    http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models })),
    http.post(`${API}/sessions/:resourceId/model`, async ({ request }) => {
      const body: unknown = await request.json();
      if (typeof body === 'object' && body !== null && 'modelId' in body) {
        modelSwitches.push(String(body.modelId));
      }
      return HttpResponse.json({ ok: true });
    }),
  );

  const rendered = renderWithProviders(
    <MemoryRouter>
      <ChatSessionContext.Provider value={{ ...baseSession, kind }}>
        <ChatConnectionContext.Provider
          value={{
            status: 'ready',
            state: { controllerId: AGENT_CONTROLLER_ID, resourceId: 'session-1', modeId: 'build', modelId },
          }}
        >
          <ChatModesContext.Provider
            value={{
              modes: [{ id: 'build', name: 'Build' }],
              activeMode: { id: 'build', name: 'Build' },
              activeModeId: 'build',
              isLoading: false,
              error: undefined,
              setMode: async () => {},
            }}
          >
            <ChatModelsProvider>
              <ModelPicker />
              <Toaster position="bottom-right" />
            </ChatModelsProvider>
          </ChatModesContext.Provider>
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
  return { ...rendered, modelSwitches };
}

describe('ModelPicker', () => {
  it('shows only provider-grouped models and marks the default', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(await screen.findByLabelText('Session model'));

    expect(screen.getByText('anthropic')).toBeInTheDocument();
    expect(screen.getByText('openai')).toBeInTheDocument();
    const defaultOption = screen.getByRole('option', { name: /claude-sonnet-4-5/i });
    expect(within(defaultOption).getByText('Default')).toBeInTheDocument();
  });

  it('resets a deviating user session to the personal default', async () => {
    const user = userEvent.setup();
    const { client, modelSwitches } = renderPicker();

    await user.click(await screen.findByLabelText('Session model'));
    await user.click(screen.getByRole('option', { name: 'Reset to your default' }));
    await waitForMutationsIdle(client);

    await waitFor(() => expect(modelSwitches).toEqual(['anthropic/claude-sonnet-4-5']));
  });

  it('hides reset when the active model already matches the default', async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'anthropic/claude-sonnet-4-5' });

    await user.click(await screen.findByLabelText('Session model'));

    expect(screen.queryByRole('option', { name: 'Reset to your default' })).not.toBeInTheDocument();
  });

  it('hides reset when the saved default is unavailable', async () => {
    const user = userEvent.setup();
    renderPicker({ defaultModelId: 'google/gemini-unavailable' });

    await user.click(await screen.findByLabelText('Session model'));

    expect(screen.queryByRole('option', { name: 'Reset to your default' })).not.toBeInTheDocument();
  });

  it('keeps factory sessions model-only with no personal reset', async () => {
    const user = userEvent.setup();
    renderPicker({ kind: 'factory' });

    await user.click(await screen.findByLabelText('Session model'));

    expect(screen.getByRole('option', { name: /gpt-5/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Reset to your default' })).not.toBeInTheDocument();
  });
});
