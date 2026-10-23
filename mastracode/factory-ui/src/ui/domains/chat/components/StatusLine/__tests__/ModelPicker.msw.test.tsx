import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import { ChatModelsProvider } from '../../../context/ChatModelsProvider';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../../context/ChatSessionContext';
import { ChatThinkingProvider } from '../../../context/ChatThinkingProvider';
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
  sessionId: 'session-1',
  resourceId: 'user-1',
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
  thinkingDefaultsFail = false,
  inFactory = false,
  modelScope,
  factoryDefaultModelId,
  emptyCatalog = false,
  catalogFails = false,
  sessionPolicy,
}: {
  kind?: ChatSessionContextApi['kind'];
  modelId?: string;
  defaultModelId?: string | null;
  thinkingLevel?: string;
  settingsLoaded?: Promise<void>;
  catalogLoaded?: Promise<void>;
  modelSwitched?: Promise<void>;
  thinkingDefaultsFail?: boolean;
  /** Mount on a Factory route, so the Factory's thinking level applies. */
  inFactory?: boolean;
  /** Mount on a Factory route whose project has this model scope. */
  modelScope?: 'factory' | 'user' | 'hybrid';
  factoryDefaultModelId?: string;
  sessionPolicy?: {
    modelScope: 'factory' | 'user';
    defaultModelId: string | null;
    personalThinkingLevel?: ThinkingLevelSetting | null;
  };
  /** The Factory's scope has no credentials, so its catalog is empty. */
  emptyCatalog?: boolean;
  /** The session catalog request fails. */
  catalogFails?: boolean;
} = {}) {
  const modelSwitches: unknown[] = [];
  const stateUpdates: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: defaultModelId, thinkingLevel: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, async ({ request }) => {
      await catalogLoaded;
      if (!modelScope) return HttpResponse.json({ models });
      const params = new URL(request.url).searchParams;
      if (params.has('resourceId')) {
        if (catalogFails) {
          return HttpResponse.json({ error: 'session_model_policy_unavailable' }, { status: 503 });
        }
        expect(params.get('sessionId')).toBe('session-1');
        expect(params.get('resourceId')).toBe('user-1');
        expect(params.get('threadId')).toBe('session-1');
        const effectiveScope = sessionPolicy?.modelScope ?? (modelScope === 'hybrid' ? kind : modelScope);
        return HttpResponse.json({
          modelScope: effectiveScope,
          defaultModelId: sessionPolicy
            ? sessionPolicy.defaultModelId
            : effectiveScope === 'factory'
              ? (factoryDefaultModelId ?? null)
              : defaultModelId,
          personalThinkingLevel: sessionPolicy?.personalThinkingLevel ?? null,
          models: emptyCatalog
            ? []
            : models.filter(model => model.provider === (effectiveScope === 'factory' ? 'openai' : 'anthropic')),
        });
      }
      if (emptyCatalog) return HttpResponse.json({ models: [] });
      // Settings requests stay independent of the session owner's catalog.
      const factoryId = params.get('factoryId');
      if (params.get('scope') === 'user') {
        return HttpResponse.json({ models: models.filter(model => model.provider === 'anthropic') });
      }
      return HttpResponse.json({
        models: models.filter(model => (factoryId === 'fp-1') === (model.provider === 'openai')),
      });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      thinkingDefaultsFail
        ? HttpResponse.json({ error: 'unavailable' }, { status: 500 })
        : HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultThinkingLevel: 'medium' } }),
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
          thinkingLevel = typeof state.thinkingLevel === 'string' ? state.thinkingLevel : undefined;
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
  if (modelScope) {
    window.__MASTRACODE_CONFIG__ = { authEnabled: true };
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, user: { id: 'user-1', organizationId: 'org-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
        HttpResponse.json({
          project: {
            id: 'fp-1',
            name: 'Mastra',
            modelScope,
            defaultModelId: factoryDefaultModelId,
            defaultThinkingLevel: 'medium',
          },
        }),
      ),
    );
  }

  const picker = (
    <ChatSessionContext.Provider value={{ ...baseSession, kind }}>
      <ChatConnectionContext.Provider
        value={{
          status: 'ready',
          state: {
            controllerId: AGENT_CONTROLLER_ID,
            sessionId: 'session-1',
            resourceId: 'user-1',
            modeId: 'build',
            modelId,
          },
        }}
      >
        <ChatModelsProvider>
          <ChatThinkingProvider>
            <ModelPicker />
            <Toaster position="bottom-right" />
          </ChatThinkingProvider>
        </ChatModelsProvider>
      </ChatConnectionContext.Provider>
    </ChatSessionContext.Provider>
  );
  const rendered = renderWithProviders(
    modelScope || inFactory ? (
      <MemoryRouter initialEntries={['/factories/fp-1/work']}>
        <Routes>
          <Route path="/factories/:factoryId/*" element={picker} />
        </Routes>
      </MemoryRouter>
    ) : (
      <MemoryRouter>{picker}</MemoryRouter>
    ),
  );
  return { ...rendered, modelSwitches, stateUpdates };
}

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
  server.events.removeAllListeners('response:mocked');
});

describe('ModelPicker', () => {
  it.each(['user', 'hybrid'] as const)(
    'shows the thread owner catalog and default to a collaborator in %s scope',
    async modelScope => {
      const user = userEvent.setup();
      renderPicker({
        modelScope,
        kind: 'user',
        modelId: 'anthropic/claude-sonnet-4-6',
        defaultModelId: 'openai/gpt-5',
        sessionPolicy: { modelScope: 'user', defaultModelId: 'anthropic/claude-sonnet-4-6' },
      });

      await user.click(await screen.findByLabelText('Session model'));
      const ownerOption = await screen.findByRole('option', { name: /claude-sonnet-4-6/ });
      expect(within(ownerOption).getByText('Default')).toBeVisible();
      expect(screen.queryByRole('option', { name: /gpt-5/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/not configured/)).not.toBeInTheDocument();
    },
  );

  it('keeps a completed hybrid work-item thread on the server-resolved Factory catalog on a personal route', async () => {
    const user = userEvent.setup();
    renderPicker({
      modelScope: 'hybrid',
      kind: 'user',
      sessionPolicy: { modelScope: 'factory', defaultModelId: 'openai/gpt-5' },
    });

    await user.click(await screen.findByLabelText('Session model'));
    const factoryOption = await screen.findByRole('option', { name: /gpt-5/ });
    expect(within(factoryOption).getByText('Default')).toBeVisible();
    expect(screen.queryByRole('option', { name: /claude-sonnet-4-6/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('note')).toHaveTextContent(
      "Showing models this Factory's organization credentials can run.",
    );
  });

  it("starts a chat on personal defaults at its owner's personal thinking level", async () => {
    const user = userEvent.setup();
    renderPicker({
      modelScope: 'user',
      modelId: 'anthropic/claude-sonnet-4-6',
      sessionPolicy: {
        modelScope: 'user',
        defaultModelId: 'anthropic/claude-sonnet-4-6',
        personalThinkingLevel: 'high',
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Thinking: High · Personal default' }));
    expect(screen.getByText('Follows the Personal default.')).toBeInTheDocument();
  });

  it('uses personal credentials to show a hybrid user session model as configured', async () => {
    const user = userEvent.setup();
    renderPicker({
      modelScope: 'hybrid',
      kind: 'user',
      modelId: 'anthropic/claude-sonnet-4-6',
      factoryDefaultModelId: 'openai/gpt-5',
    });

    await user.click(await screen.findByRole('button', { name: 'Session model' }));
    const personalOption = await screen.findByRole('option', { name: /claude-sonnet-4-6/ });
    expect(within(personalOption).getByText('Default')).toBeVisible();
    expect(screen.queryByRole('option', { name: /gpt-5/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/not configured/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing models this Factory/)).not.toBeInTheDocument();
  });

  it.each(['factory', 'hybrid'] as const)(
    'marks the Factory default rather than the personal default in a %s work-item session',
    async modelScope => {
      const user = userEvent.setup();
      renderPicker({ kind: 'factory', modelScope, factoryDefaultModelId: 'openai/gpt-5' });

      await user.click(await screen.findByLabelText('Session model'));
      const option = await screen.findByRole('option', { name: /gpt-5/ });
      expect(within(option).getByText('Default')).toBeVisible();
      expect(screen.queryByRole('option', { name: /Reset to your default/ })).not.toBeInTheDocument();
    },
  );

  it('says the list is limited to organization credentials in an organization-scoped Factory', async () => {
    const user = userEvent.setup();
    renderPicker({ modelScope: 'factory' });

    await user.click(await screen.findByLabelText('Session model'));

    expect(screen.getByRole('option', { name: /gpt-5/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /claude-sonnet-4-6/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('note')).toHaveTextContent(
      "Showing models this Factory's organization credentials can run.",
    );
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/factories/fp-1/settings/models');
  });

  it('points an organization-scoped Factory with no usable models at its credential settings', async () => {
    renderPicker({ modelScope: 'factory', emptyCatalog: true });

    expect(await screen.findByRole('link', { name: 'needs an organization credential' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/models',
    );
    expect(screen.queryByLabelText('Session model')).not.toBeInTheDocument();
  });

  it('reports a failed session catalog instead of staying locked as loading', async () => {
    renderPicker({ modelScope: 'hybrid', kind: 'user', catalogFails: true });

    const unavailable = await screen.findByLabelText('GPT-5 · model list unavailable');
    expect(unavailable).toHaveTextContent('GPT-5 · model list unavailable');
    expect(screen.queryByRole('button', { name: /^Session model/ })).not.toBeInTheDocument();
  });

  it('keeps the plain not-configured label for a personal-scoped Factory with no usable models', async () => {
    renderPicker({ modelScope: 'user', emptyCatalog: true });

    expect(await screen.findByLabelText(/gpt-5 is not configured/i)).toHaveTextContent('· not configured');
    expect(screen.queryByRole('link', { name: 'needs an organization credential' })).not.toBeInTheDocument();
  });

  it('leaves the list unexplained when the Factory uses personal credentials', async () => {
    const user = userEvent.setup();
    const projectLoaded = new Promise<void>(resolve => {
      server.events.on('response:mocked', ({ request }) => {
        if (request.url.endsWith('/web/factory/projects/fp-1')) resolve();
      });
    });
    renderPicker({ modelScope: 'user' });

    await user.click(await screen.findByLabelText('Session model'));
    await projectLoaded;
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.getByRole('option', { name: /claude-sonnet-4-6/i })).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

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

    await screen.findByRole('button', { name: 'Thinking: Max · this session' });
    await user.click(screen.getByLabelText('Session model'));
    await user.click(screen.getByRole('option', { name: /gpt-5/i }));
    await waitForMutationsIdle(client);

    expect(modelSwitches).toEqual([{ modelId: 'openai/gpt-5' }]);
    expect(stateUpdates).toEqual([]);
  });

  it('shows the level the model runs when the saved choice is above what it supports', async () => {
    renderPicker({ modelId: 'openai/gpt-5', thinkingLevel: 'max' });

    expect(await screen.findByRole('button', { name: 'Thinking: High · this session' })).toBeEnabled();
  });

  it('given no session level, when the session picks one, then it leaves the Factory default and saves it', async () => {
    const user = userEvent.setup();
    const { client, stateUpdates } = renderPicker({ inFactory: true });

    await user.click(await screen.findByRole('button', { name: 'Thinking: Medium · Factory default' }));
    expect(screen.getByText('Follows the Factory default.')).toBeInTheDocument();
    const ramp = screen.getByRole('slider', { name: 'Thinking' });
    expect(screen.queryByText('Max')).not.toBeInTheDocument();
    fireEvent.change(ramp, { target: { value: '3' } });
    fireEvent.keyUp(ramp);
    await waitForMutationsIdle(client);

    expect(stateUpdates).toEqual([{ thinkingLevel: 'high' }]);
    expect(screen.getByRole('button', { name: 'Thinking: High · this session' })).toBeInTheDocument();
    expect(screen.getByText('Set for this session.')).toBeInTheDocument();
  });

  it('given a session level, when Use default is chosen, then the session follows the Factory default', async () => {
    const user = userEvent.setup();
    const { client, stateUpdates } = renderPicker({ thinkingLevel: 'high', inFactory: true });

    await user.click(await screen.findByRole('button', { name: 'Thinking: High · this session' }));
    await user.click(screen.getByRole('button', { name: 'Use default' }));
    await waitForMutationsIdle(client);

    expect(stateUpdates).toEqual([{ thinkingLevel: null }]);
    expect(screen.getByRole('button', { name: 'Thinking: Medium · Factory default' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use default' })).not.toBeInTheDocument();
  });

  it('says the thinking level failed to load instead of loading forever', async () => {
    renderPicker({ thinkingDefaultsFail: true, inFactory: true });

    expect(
      await screen.findByRole(
        'button',
        { name: "Thinking: unavailable. The thinking level couldn't be loaded." },
        { timeout: 10_000 },
      ),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it("keeps the session's own level usable when the defaults fail to load", async () => {
    renderPicker({ thinkingLevel: 'high', thinkingDefaultsFail: true, inFactory: true });

    expect(await screen.findByRole('button', { name: 'Thinking: High · this session' })).toBeEnabled();
  });

  it('holds the thinking control disabled, not the Factory default, until the session level loads', async () => {
    let loadSettings = () => {};
    const settingsLoaded = new Promise<void>(resolve => {
      loadSettings = resolve;
    });
    renderPicker({ thinkingLevel: 'high', settingsLoaded });

    expect(
      await screen.findByRole('button', { name: "Thinking: unavailable. The thinking level isn't loaded yet." }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: 'Thinking: Medium · Factory default' })).not.toBeInTheDocument();

    loadSettings();
    expect(await screen.findByRole('button', { name: 'Thinking: High · this session' })).toBeEnabled();
  });

  it("holds the thinking control until the model's levels load, then shows the level it runs", async () => {
    let loadCatalog = () => {};
    const catalogLoaded = new Promise<void>(resolve => {
      loadCatalog = resolve;
    });
    renderPicker({ modelId: 'openai/gpt-5', thinkingLevel: 'max', catalogLoaded });

    expect(
      await screen.findByRole('button', {
        name: "Thinking: unavailable. This model's thinking levels aren't loaded yet.",
      }),
    ).toHaveAttribute('aria-disabled', 'true');

    loadCatalog();
    expect(await screen.findByRole('button', { name: 'Thinking: High · this session' })).toBeEnabled();
  });

  it('locks the thinking level while a model switch is in flight', async () => {
    let finishSwitch = () => {};
    const modelSwitched = new Promise<void>(resolve => {
      finishSwitch = resolve;
    });
    const user = userEvent.setup();
    const { client } = renderPicker({ modelId: 'anthropic/claude-sonnet-4-6', thinkingLevel: 'high', modelSwitched });

    await screen.findByRole('button', { name: 'Thinking: High · this session' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session model' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Session model' }));
    await user.click(screen.getByRole('option', { name: /gpt-5/i }));

    expect(await screen.findByRole('button', { name: 'Thinking: unavailable. Switching model…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    finishSwitch();
    await waitForMutationsIdle(client);
    expect(await screen.findByRole('button', { name: 'Thinking: High · this session' })).toBeEnabled();
  });
});
