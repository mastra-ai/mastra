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
import { ChangeModelAction, ModelPicker } from '../ModelPicker';
import { datedModels } from '../../../../settings/components/__tests__/fixtures/models';

/** Opens the model picker and returns its thinking section, named by level and origin. */
async function openThinking(
  user: ReturnType<typeof userEvent.setup>,
  name: string | RegExp,
  options?: { timeout: number },
) {
  const trigger = await screen.findByLabelText(/^Session model/, undefined, options);
  await waitFor(() => expect(trigger).toBeEnabled(), options);
  if (trigger.getAttribute('aria-expanded') !== 'true') await user.click(trigger);
  return screen.findByRole('group', { name }, options);
}

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
  catalog = models,
  withChangeModelAction = false,
}: {
  catalog?: AvailableModelOption[];
  kind?: ChatSessionContextApi['kind'];
  modelId?: string;
  defaultModelId?: string | null;
  thinkingLevel?: string;
  settingsLoaded?: Promise<void>;
  catalogLoaded?: Promise<void>;
  modelSwitched?: Promise<void>;
  thinkingDefaultsFail?: boolean;
  /** Mount on a Factory-routed Factory, so the Factory's thinking level applies. */
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
  withChangeModelAction?: boolean;
} = {}) {
  const modelSwitches: unknown[] = [];
  const stateUpdates: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: defaultModelId, thinkingLevel: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, async ({ request }) => {
      await catalogLoaded;
      if (!modelScope) return HttpResponse.json({ models: catalog });
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
        : HttpResponse.json({
            project: { id: 'fp-1', name: 'Mastra', modelScope: 'factory', defaultThinkingLevel: 'medium' },
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
            defaultThinkingLevel: 'low',
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
            {withChangeModelAction ? <ChangeModelAction /> : null}
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
  describe('when the catalog contains release dates', () => {
    it('offers newer models first within each provider', async () => {
      const user = userEvent.setup();
      renderPicker({ catalog: datedModels, defaultModelId: 'openai/gpt-5' });
      await user.click(await screen.findByLabelText('Session model'));
      const options = await screen.findAllByRole('option');
      expect(options.map(option => option.getAttribute('data-value'))).toEqual([
        'openai/gpt-5',
        'openai/gpt-4.1',
        'openai/gpt-4o',
      ]);
    });
  });
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
      const ownerOption = await screen.findByRole('option', { name: /Claude Sonnet 4\.6/ });
      expect(within(ownerOption).getByText('Default')).toBeVisible();
      expect(screen.queryByRole('option', { name: /GPT-5/ })).not.toBeInTheDocument();
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
    const factoryOption = await screen.findByRole('option', { name: /GPT-5/ });
    expect(within(factoryOption).getByText('Default')).toBeVisible();
    expect(screen.queryByRole('option', { name: /Claude Sonnet 4\.6/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Add an organization credential' })).toBeInTheDocument();
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

    expect(await openThinking(user, 'Thinking: High (Personal default)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use default' })).not.toBeInTheDocument();
  });

  it("starts a chat on personal defaults at medium, never the Factory's level, when its owner set no personal level", async () => {
    const user = userEvent.setup();
    renderPicker({
      modelScope: 'user',
      modelId: 'anthropic/claude-sonnet-4-6',
      sessionPolicy: { modelScope: 'user', defaultModelId: 'anthropic/claude-sonnet-4-6', personalThinkingLevel: null },
    });

    expect(await openThinking(user, 'Thinking: Medium (Built-in default)')).toBeInTheDocument();
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
    const personalOption = await screen.findByRole('option', { name: /Claude Sonnet 4\.6/ });
    expect(within(personalOption).getByText('Default')).toBeVisible();
    expect(screen.queryByRole('option', { name: /GPT-5/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/not configured/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect a provider' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add an organization credential' })).not.toBeInTheDocument();
  });

  it.each(['factory', 'hybrid'] as const)(
    'marks the Factory default rather than the personal default in a %s work-item session',
    async modelScope => {
      const user = userEvent.setup();
      renderPicker({ kind: 'factory', modelScope, factoryDefaultModelId: 'openai/gpt-5' });

      await user.click(await screen.findByLabelText('Session model'));
      const option = await screen.findByRole('option', { name: /GPT-5/ });
      expect(within(option).getByText('Default')).toBeVisible();
      expect(screen.queryByRole('option', { name: /Reset to your default/ })).not.toBeInTheDocument();
    },
  );

  it('offers an organization credential, not a personal connection, in an organization-scoped Factory', async () => {
    const user = userEvent.setup();
    renderPicker({ modelScope: 'factory' });

    await user.click(await screen.findByLabelText('Session model'));

    expect(screen.getByRole('option', { name: /GPT-5/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Claude Sonnet 4\.6/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Add an organization credential' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add an organization credential' }).getAttribute('href')).toMatch(
      /^\/factories\/fp-1\/settings\/models/,
    );
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

    const unavailable = await screen.findByLabelText('GPT-5: model list unavailable');
    expect(within(unavailable).getByText('GPT-5')).toBeInTheDocument();
    expect(within(unavailable).getByText('model list unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Session model/ })).not.toBeInTheDocument();
  });

  it('keeps the plain not-configured label for a personal-scoped Factory with no usable models', async () => {
    renderPicker({ modelScope: 'user', emptyCatalog: true });

    expect(await screen.findByLabelText(/gpt-5 is not configured/i)).toHaveTextContent('not configured');
    expect(screen.queryByRole('link', { name: 'needs an organization credential' })).not.toBeInTheDocument();
  });

  it('offers to connect a personal provider when the Factory uses personal credentials', async () => {
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

    expect(screen.getByRole('option', { name: /Claude Sonnet 4\.6/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect a provider' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add an organization credential' })).not.toBeInTheDocument();
  });

  it('shows only provider-grouped models and marks the default', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(await screen.findByLabelText('Session model'));

    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    const defaultOption = screen.getByRole('option', { name: /Claude Sonnet 4\.6/ });
    expect(within(defaultOption).getByText('Default')).toBeInTheDocument();
  });

  it("links to the Factory's model settings to connect another provider", async () => {
    const user = userEvent.setup();
    renderPicker({ inFactory: true });

    await user.click(await screen.findByLabelText('Session model'));

    const connect = screen.getByRole('link', { name: 'Connect a provider' });
    expect(connect.getAttribute('href')).toMatch(/^\/factories\/fp-1\/settings\/models/);
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

    expect(screen.getByRole('option', { name: /GPT-5/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Reset to your default' })).not.toBeInTheDocument();
  });

  it('keeps the saved thinking choice when switching to a model that cannot run it', async () => {
    const user = userEvent.setup();
    const { client, modelSwitches, stateUpdates } = renderPicker({
      modelId: 'anthropic/claude-sonnet-4-6',
      thinkingLevel: 'max',
    });

    await openThinking(user, 'Thinking: Max (this session)');
    await user.click(screen.getByRole('option', { name: /GPT-5/ }));
    await waitForMutationsIdle(client);

    expect(modelSwitches).toEqual([{ modelId: 'openai/gpt-5' }]);
    expect(stateUpdates).toEqual([]);
  });

  it('shows the level the model runs when the saved choice is above what it supports', async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'openai/gpt-5', thinkingLevel: 'max' });

    const thinking = await openThinking(user, 'Thinking: High (this session)');
    expect(within(thinking).getByRole('slider', { name: 'Thinking' })).toBeEnabled();
  });

  it('given no session level, when the session picks one, then it leaves the Factory default and saves it', async () => {
    const user = userEvent.setup();
    const { client, stateUpdates } = renderPicker({ inFactory: true });

    await openThinking(user, 'Thinking: Medium (Factory default)');
    const ramp = screen.getByRole('slider', { name: 'Thinking' });
    expect(screen.queryByText('Max')).not.toBeInTheDocument();
    fireEvent.change(ramp, { target: { value: '3' } });
    fireEvent.keyUp(ramp);
    await waitForMutationsIdle(client);

    expect(stateUpdates).toEqual([{ thinkingLevel: 'high' }]);
    expect(await screen.findByRole('group', { name: 'Thinking: High (this session)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use default' })).toBeInTheDocument();
  });

  it('given a session level, when Use default is chosen, then the session follows the Factory default', async () => {
    const user = userEvent.setup();
    const { client, stateUpdates } = renderPicker({ thinkingLevel: 'high', inFactory: true });

    await openThinking(user, 'Thinking: High (this session)');
    await user.click(screen.getByRole('button', { name: 'Use default' }));
    await waitForMutationsIdle(client);

    expect(stateUpdates).toEqual([{ thinkingLevel: null }]);
    expect(await screen.findByRole('group', { name: 'Thinking: Medium (Factory default)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use default' })).not.toBeInTheDocument();
  });

  it('keeps the thinking section in place, disabled, when its level fails to load', async () => {
    const user = userEvent.setup();
    renderPicker({ thinkingDefaultsFail: true, inFactory: true });

    const thinking = await openThinking(user, "Thinking: unavailable. The thinking level couldn't be loaded.", {
      timeout: 10_000,
    });
    expect(within(thinking).getByRole('slider', { name: 'Thinking' })).toBeDisabled();
    expect(within(thinking).getByText("The thinking level couldn't be loaded.")).toBeVisible();
  });

  it("keeps the session's own level usable when the defaults fail to load", async () => {
    const user = userEvent.setup();
    renderPicker({ thinkingLevel: 'high', thinkingDefaultsFail: true, inFactory: true });

    const thinking = await openThinking(user, 'Thinking: High (this session)');
    expect(within(thinking).getByRole('slider', { name: 'Thinking' })).toBeEnabled();
  });

  it('holds the thinking section disabled, not on the Factory default, until the session level loads', async () => {
    let loadSettings = () => {};
    const settingsLoaded = new Promise<void>(resolve => {
      loadSettings = resolve;
    });
    const user = userEvent.setup();
    renderPicker({ thinkingLevel: 'high', settingsLoaded });

    const pending = await openThinking(user, 'Thinking: loading');
    expect(within(pending).getByRole('slider', { name: 'Thinking' })).toBeDisabled();
    expect(screen.queryByRole('group', { name: 'Thinking: Medium (Factory default)' })).not.toBeInTheDocument();

    loadSettings();
    const thinking = await screen.findByRole('group', { name: 'Thinking: High (this session)' });
    expect(within(thinking).getByRole('slider', { name: 'Thinking' })).toBeEnabled();
  });

  it("holds the thinking control until the model's levels load, then shows the level it runs", async () => {
    let loadCatalog = () => {};
    const catalogLoaded = new Promise<void>(resolve => {
      loadCatalog = resolve;
    });
    const user = userEvent.setup();
    renderPicker({ modelId: 'openai/gpt-5', thinkingLevel: 'max', catalogLoaded });

    expect(await screen.findByLabelText('Session model')).toBeDisabled();

    loadCatalog();
    const thinking = await openThinking(user, 'Thinking: High (this session)');
    expect(within(thinking).getByRole('slider', { name: 'Thinking' })).toBeEnabled();
  });

  it('locks the thinking level while a model switch is in flight', async () => {
    let finishSwitch = () => {};
    const modelSwitched = new Promise<void>(resolve => {
      finishSwitch = resolve;
    });
    const user = userEvent.setup();
    const { client } = renderPicker({ modelId: 'anthropic/claude-sonnet-4-6', thinkingLevel: 'high', modelSwitched });

    await openThinking(user, 'Thinking: High (this session)');
    await user.click(screen.getByRole('option', { name: /GPT-5/ }));

    const sessionModel = screen.getByRole('button', { name: 'Session model' });
    await waitFor(() => expect(sessionModel).toBeDisabled());
    expect(sessionModel).toHaveAttribute('aria-busy', 'true');

    finishSwitch();
    await waitForMutationsIdle(client);
    const thinking = await openThinking(user, 'Thinking: High (this session)');
    expect(within(thinking).getByRole('slider', { name: 'Thinking' })).toBeEnabled();
  });

  it('locks the status-line picker while the error card switches the model', async () => {
    let finishSwitch = () => {};
    const modelSwitched = new Promise<void>(resolve => {
      finishSwitch = resolve;
    });
    const user = userEvent.setup();
    const { client } = renderPicker({
      modelId: 'anthropic/claude-sonnet-4-6',
      thinkingLevel: 'high',
      modelSwitched,
      withChangeModelAction: true,
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Change model' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Change model' }));
    await user.click(screen.getByRole('option', { name: /GPT-5/ }));

    const sessionModel = await screen.findByRole('button', { name: 'Session model' });
    await waitFor(() => expect(sessionModel).toBeDisabled());
    expect(sessionModel).toHaveTextContent(/gpt-5/i);
    expect(sessionModel).toHaveAttribute('aria-busy', 'true');

    finishSwitch();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session model' })).toBeEnabled());
  });
});
