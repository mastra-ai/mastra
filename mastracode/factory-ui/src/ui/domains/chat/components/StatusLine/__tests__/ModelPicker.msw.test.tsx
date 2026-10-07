import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import type { ThinkingConfigInfo } from '../../../../../../api/types';
import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { thinkingConfig } from '../../../../../__tests__/fixtures/thinkingConfig';
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
const models: AvailableModelOption[] = [
  {
    id: 'anthropic/claude-sonnet-4-6',
    provider: 'anthropic',
    modelName: 'claude-sonnet-4-6',
    hasApiKey: true,
    reasoningOptions: [
      { type: 'effort', values: ['low', 'medium', 'high', 'max'] },
      { type: 'budget_tokens', min: 1024 },
    ],
  },
  {
    id: 'openai/gpt-5',
    provider: 'openai',
    modelName: 'gpt-5',
    hasApiKey: true,
    reasoningOptions: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high'] }],
  },
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
  defaultModelId = 'anthropic/claude-sonnet-4-6',
  thinkingLevel,
  settingsLoaded,
  catalogLoaded,
  modelSwitched,
}: {
  kind?: ChatSessionContextApi['kind'];
  modelId?: string;
  defaultModelId?: string | null;
  thinkingLevel?: string;
  settingsLoaded?: Promise<void>;
  catalogLoaded?: Promise<void>;
  modelSwitched?: Promise<void>;
} = {}) {
  const modelSwitches: unknown[] = [];
  const stateUpdates: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () => HttpResponse.json({ modelId: defaultModelId })),
    http.get(`${TEST_BASE_URL}/web/config/models`, async () => {
      await catalogLoaded;
      return HttpResponse.json({ models });
    }),
    http.get(`${TEST_BASE_URL}/web/config/thinking`, () =>
      HttpResponse.json<ThinkingConfigInfo>({
        ...thinkingConfig,
        globalDefault: 'low',
        modeDefaults: { build: 'medium' },
      }),
    ),
    http.get(`${API}/sessions/:resourceId`, async ({ params }) => {
      await settingsLoaded;
      return HttpResponse.json({
        controllerId: AGENT_CONTROLLER_ID,
        resourceId: params.resourceId,
        modeId: 'build',
        modelId,
        settings: { yolo: false, thinkingLevel, notifications: 'off', smartEditing: true },
      });
    }),
    http.put(`${API}/sessions/:resourceId/state`, async ({ request }) => {
      const body: unknown = await request.json();
      if (typeof body === 'object' && body !== null && 'state' in body) {
        stateUpdates.push(body.state);
        const state: unknown = body.state;
        if (typeof state === 'object' && state !== null && 'thinkingLevel' in state) {
          thinkingLevel = String(state.thinkingLevel);
        }
      }
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${API}/sessions/:resourceId/model`, async ({ request }) => {
      modelSwitches.push(await request.json());
      await modelSwitched;
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
  return { ...rendered, modelSwitches, stateUpdates };
}

describe('ModelPicker', () => {
  it('shows only provider-grouped models and marks the default', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(await screen.findByLabelText('Session model'));

    expect(screen.getByText('anthropic')).toBeInTheDocument();
    expect(screen.getByText('openai')).toBeInTheDocument();
    const defaultOption = screen.getByRole('option', { name: /claude-sonnet-4-6/i });
    expect(within(defaultOption).getByText('Default')).toBeInTheDocument();
  });

  it('resets a deviating user session to the personal default', async () => {
    const user = userEvent.setup();
    const { client, modelSwitches } = renderPicker();

    await user.click(await screen.findByLabelText('Session model'));
    await user.click(screen.getByRole('option', { name: 'Reset to your default' }));
    await waitForMutationsIdle(client);

    await waitFor(() => expect(modelSwitches).toEqual([{ modelId: 'anthropic/claude-sonnet-4-6' }]));
  });

  it('hides reset when the active model already matches the default', async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'anthropic/claude-sonnet-4-6' });

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

  it('keeps the saved thinking choice when switching to a model that cannot run it', async () => {
    const user = userEvent.setup();
    const { client, modelSwitches, stateUpdates } = renderPicker({
      modelId: 'anthropic/claude-sonnet-4-6',
      thinkingLevel: 'max',
    });

    await screen.findByRole('button', { name: 'Thinking: Max' });
    await user.click(screen.getByLabelText('Session model'));
    await user.click(screen.getByRole('option', { name: /gpt-5/i }));
    await waitForMutationsIdle(client);

    expect(modelSwitches).toEqual([{ modelId: 'openai/gpt-5' }]);
    expect(stateUpdates).toEqual([]);
  });

  it('shows the level the model runs when the saved choice is above what it supports', async () => {
    renderPicker({ modelId: 'openai/gpt-5', thinkingLevel: 'max' });

    expect(await screen.findByRole('button', { name: 'Thinking: High' })).toBeEnabled();
  });

  it('shows the mode default until the session picks its own level, then saves it', async () => {
    const user = userEvent.setup();
    const { client, stateUpdates } = renderPicker();

    await user.click(await screen.findByRole('button', { name: 'Thinking: Medium' }));
    const ramp = screen.getByRole('slider', { name: 'Thinking' });
    expect(screen.queryByText('Max')).not.toBeInTheDocument();
    fireEvent.change(ramp, { target: { value: '3' } });
    fireEvent.keyUp(ramp);
    await waitForMutationsIdle(client);

    expect(stateUpdates).toEqual([{ thinkingLevel: 'high' }]);
    expect(screen.getByRole('button', { name: 'Thinking: High' })).toBeInTheDocument();
  });

  it('holds the thinking control disabled, not the mode default, until the session level loads', async () => {
    let loadSettings = () => {};
    const settingsLoaded = new Promise<void>(resolve => {
      loadSettings = resolve;
    });
    renderPicker({ thinkingLevel: 'high', settingsLoaded });

    expect(
      await screen.findByRole('button', { name: "Thinking: unavailable. The thinking level isn't loaded yet." }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: 'Thinking: Medium' })).not.toBeInTheDocument();

    loadSettings();
    expect(await screen.findByRole('button', { name: 'Thinking: High' })).toBeEnabled();
  });

  it('offers the thinking level while the model list is still loading', async () => {
    let loadCatalog = () => {};
    const catalogLoaded = new Promise<void>(resolve => {
      loadCatalog = resolve;
    });
    renderPicker({ thinkingLevel: 'high', catalogLoaded });

    expect(await screen.findByRole('button', { name: 'Thinking: High' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Session model' })).toBeDisabled();

    loadCatalog();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session model' })).toBeEnabled());
  });

  it('locks the thinking level while a model switch is in flight', async () => {
    let finishSwitch = () => {};
    const modelSwitched = new Promise<void>(resolve => {
      finishSwitch = resolve;
    });
    const user = userEvent.setup();
    const { client } = renderPicker({ modelId: 'anthropic/claude-sonnet-4-6', thinkingLevel: 'high', modelSwitched });

    await screen.findByRole('button', { name: 'Thinking: High' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session model' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Session model' }));
    await user.click(screen.getByRole('option', { name: /gpt-5/i }));

    expect(await screen.findByRole('button', { name: 'Thinking: unavailable. Switching model…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    finishSwitch();
    await waitForMutationsIdle(client);
    expect(await screen.findByRole('button', { name: 'Thinking: High' })).toBeEnabled();
  });
});
