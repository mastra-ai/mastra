import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import { queryKeys } from '../../../../../../api/keys';
import type { ModelPackInfo } from '../../../../../../api/types';
import { AGENT_CONTROLLER_ID } from '../../../services/constants';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import type { ChatConnectionApi } from '../../../context/ChatConnectionContext';
import { ChatModelsContext } from '../../../context/ChatModelsContext';
import type { ChatModelsApi } from '../../../context/ChatModelsContext';
import { ChatModelsProvider } from '../../../context/ChatModelsProvider';
import { ChatModesContext } from '../../../context/ChatModesContext';
import type { ChatModesApi } from '../../../context/ChatModesContext';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../../context/ChatSessionContext';
import { ModelPicker } from '../ModelPicker';

// cmdk scrolls the highlighted option into view; jsdom has no scrollIntoView.
if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const baseSession: ChatSessionContextApi = {
  resourceId: 'session-1',
  sessionEnabled: true,
  resourceReady: true,
  sandboxReady: true,
  sandboxPreparing: false,
  sandboxProgress: undefined,
  resourceEnabled: true,
  baseUrl: TEST_BASE_URL,
  kind: 'user',
};

const buildMode: ChatModesApi['modes'][number] = { id: 'build', name: 'Build' };
const chatModes: ChatModesApi = {
  modes: [buildMode],
  activeMode: buildMode,
  activeModeId: 'build',
  isLoading: false,
  error: undefined,
  setMode: () => Promise.resolve(),
};

const packs: ModelPackInfo[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: '',
    models: { build: 'anthropic/claude-sonnet-4-5', plan: 'p/plan', fast: 'p/fast' },
    custom: false,
    active: true,
  },
  {
    id: 'mine',
    name: 'Mine',
    description: '',
    models: { build: 'openai/gpt-5.6-sol', plan: 'p/plan-2', fast: 'p/fast-2' },
    custom: true,
    active: false,
  },
];

const stubModels: ChatModelsApi = {
  activeModelId: undefined,
  activeModelPackId: undefined,
  defaultModelPackId: undefined,
  draftModelPackId: undefined,
  modelPacks: [],
  isLoading: false,
  error: undefined,
  setModel: () => Promise.resolve(),
  setModelPack: () => Promise.resolve(),
};

function renderPicker({
  session = {},
  status = 'ready',
  models = {},
}: {
  session?: Partial<ChatSessionContextApi>;
  status?: ChatConnectionApi['status'];
  models?: Partial<ChatModelsApi>;
}) {
  const merged = { ...baseSession, ...session };
  return renderWithProviders(
    <ChatRouter>
      <ChatSessionContext.Provider value={merged}>
        <ChatConnectionContext.Provider value={{ status }}>
          <ChatModesContext.Provider value={chatModes}>
            <ChatModelsContext.Provider value={{ ...stubModels, ...models }}>
              <ModelPicker />
              <Toaster position="bottom-right" />
            </ChatModelsContext.Provider>
          </ChatModesContext.Provider>
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>
    </ChatRouter>,
  );
}

/** Route wrapper so `useParams` resolves `factoryId` like in the real chat routes. */
function ChatRouter({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/factories/fp-1/user/threads/t-1']}>
      <Routes>
        <Route path="/factories/:factoryId/user/threads/:threadId" element={children} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Shows where a menu action navigated, including the hash. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="elsewhere">{`${location.pathname}${location.hash}`}</div>;
}

function stubModelCatalog(ids: string[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: ids.map(id => {
          const [provider, modelName] = id.split('/');
          return { id, provider, modelName, hasApiKey: true };
        }),
      }),
    ),
  );
}

describe('ModelPicker', () => {
  describe('when the connection is still resolving and no model id is known yet', () => {
    it('shows a loading skeleton instead of a "No model" label', () => {
      renderPicker({ status: 'connecting', models: { activeModelId: undefined } });

      expect(screen.getByLabelText('Loading model')).toBeInTheDocument();
      expect(screen.queryByText('No model')).not.toBeInTheDocument();
    });
  });

  describe('when the draft model fails to resolve', () => {
    it('shows the failure instead of a "No model" label', () => {
      renderPicker({ models: { activeModelId: undefined, error: new Error('Factory unavailable') } });

      expect(screen.getByLabelText('Model unavailable')).toHaveAttribute('title', 'Factory unavailable');
      expect(screen.queryByText('No model')).not.toBeInTheDocument();
    });
  });

  describe('when the connection is ready but reports no model', () => {
    it('falls back to the explicit "No model" label', () => {
      renderPicker({ models: { activeModelId: undefined } });

      expect(screen.getByText('No model')).toBeInTheDocument();
      expect(screen.queryByLabelText('Loading model')).not.toBeInTheDocument();
    });
  });

  describe('when the active model is missing from the credentialed catalog', () => {
    it('flags the model as not configured', async () => {
      stubModelCatalog(['openai/gpt-5']);
      renderPicker({ models: { activeModelId: 'anthropic/claude-sonnet-4-5' } });

      expect(await screen.findByLabelText('Session model, Claude Sonnet 4.5 is not configured')).toBeInTheDocument();
    });
  });

  describe('when there is no session yet — a draft composer', () => {
    it('picks the model the first prompt will create the session on', async () => {
      const user = userEvent.setup();
      const setModel = vi.fn<(modelId: string) => Promise<void>>().mockResolvedValue();
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol']);

      renderPicker({
        session: { sessionEnabled: false, sandboxReady: false, draftSessionId: 'draft-1' },
        status: 'connecting',
        models: { activeModelId: 'anthropic/claude-sonnet-4-5', setModel },
      });

      await user.click(await screen.findByLabelText('Session model'));
      await user.click(await screen.findByRole('option', { name: 'gpt-5.6-sol' }));

      expect(setModel).toHaveBeenCalledWith('openai/gpt-5.6-sol');
    });
  });

  describe('when a live user chat is ready', () => {
    it('switches the session model from the status line', async () => {
      const user = userEvent.setup();
      const setModel = vi.fn<(modelId: string) => Promise<void>>().mockResolvedValue();
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol']);
      renderPicker({ models: { activeModelId: 'anthropic/claude-sonnet-4-5', setModel } });

      await user.click(await screen.findByLabelText('Session model'));
      await user.click(await screen.findByRole('option', { name: 'gpt-5.6-sol' }));

      expect(setModel).toHaveBeenCalledWith('openai/gpt-5.6-sol');
    });

    it('disables the trigger while a switch is pending, then re-enables it', async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      const setModel = vi.fn<(modelId: string) => Promise<void>>().mockImplementation(
        () =>
          new Promise<void>(resolve => {
            finish = resolve;
          }),
      );
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol']);
      renderPicker({ models: { activeModelId: 'anthropic/claude-sonnet-4-5', setModel } });

      const trigger = await screen.findByLabelText('Session model');
      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'gpt-5.6-sol' }));

      expect(trigger).toBeDisabled();
      expect(trigger).toHaveAttribute('aria-busy', 'true');

      finish();
      await waitFor(() => expect(trigger).toBeEnabled());
      expect(trigger).toHaveAttribute('aria-busy', 'false');
    });

    it('surfaces a failed switch and keeps the control usable', async () => {
      const user = userEvent.setup();
      const setModel = vi
        .fn<(modelId: string) => Promise<void>>()
        .mockRejectedValue(new Error('Provider is unavailable'));
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol']);
      renderPicker({ models: { activeModelId: 'anthropic/claude-sonnet-4-5', setModel } });

      const trigger = await screen.findByLabelText('Session model');
      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'gpt-5.6-sol' }));

      expect(await screen.findByText('Provider is unavailable')).toBeInTheDocument();
      expect(trigger).toBeEnabled();
      expect(trigger).toHaveTextContent('Claude Sonnet 4.5');
    });
  });

  describe('when the chat is a factory session', () => {
    it('offers models but no packs', async () => {
      const user = userEvent.setup();
      stubModelCatalog(['anthropic/claude-sonnet-4-5']);
      renderPicker({
        session: { kind: 'factory' },
        models: { activeModelId: 'anthropic/claude-sonnet-4-5', modelPacks: packs },
      });

      await user.click(await screen.findByLabelText('Session model'));

      expect(await screen.findByRole('option', { name: 'claude-sonnet-4-5' })).toBeInTheDocument();
      expect(screen.getByText('anthropic')).toBeInTheDocument();
      expect(screen.queryByText('Model packs')).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Model pack Balanced' })).not.toBeInTheDocument();
    });
  });

  describe('when a user chat has model packs', () => {
    it('lists packs as presets, marks the personal default, and applies a chosen pack', async () => {
      const user = userEvent.setup();
      const setModelPack = vi.fn<(packId: string) => Promise<void>>().mockResolvedValue();
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol']);
      renderPicker({
        models: {
          activeModelId: 'anthropic/claude-sonnet-4-5',
          activeModelPackId: 'balanced',
          defaultModelPackId: 'balanced',
          modelPacks: packs,
          setModelPack,
        },
      });

      await user.click(await screen.findByLabelText('Session model'));

      const defaultPack = await screen.findByRole('option', { name: /Model pack Balanced/ });
      expect(defaultPack).toHaveTextContent('Default');
      expect(defaultPack).toHaveTextContent('Claude Sonnet 4.5 · Plan · Fast');

      await user.click(screen.getByRole('option', { name: /Model pack Mine/ }));
      expect(setModelPack).toHaveBeenCalledWith('mine');
    });

    it('surfaces a failed pack activation and keeps the control usable', async () => {
      const user = userEvent.setup();
      const setModelPack = vi
        .fn<(packId: string) => Promise<void>>()
        .mockRejectedValue(new Error('Pack storage is unavailable'));
      stubModelCatalog(['anthropic/claude-sonnet-4-5']);
      renderPicker({
        models: { activeModelId: 'anthropic/claude-sonnet-4-5', modelPacks: packs, setModelPack },
      });

      const trigger = await screen.findByLabelText('Session model');
      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: /Model pack Mine/ }));

      expect(await screen.findByText('Pack storage is unavailable')).toBeInTheDocument();
      // pendingPackId must clear on failure so another attempt is possible.
      expect(trigger).toBeEnabled();
      expect(trigger).toHaveAttribute('aria-busy', 'false');
      expect(trigger).toHaveTextContent('Claude Sonnet 4.5');
    });

    it('keeps packs selectable when no credentialed models are listed', async () => {
      const user = userEvent.setup();
      const setModelPack = vi.fn<(packId: string) => Promise<void>>().mockResolvedValue();
      stubModelCatalog([]);
      renderPicker({
        models: {
          activeModelId: 'anthropic/claude-sonnet-4-5',
          defaultModelPackId: 'balanced',
          modelPacks: packs,
          setModelPack,
        },
      });

      await user.click(await screen.findByLabelText(/Session model/));

      expect(await screen.findByRole('option', { name: /Model pack Balanced/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Manage model packs' })).toBeInTheDocument();

      await user.click(screen.getByRole('option', { name: /Model pack Mine/ }));
      expect(setModelPack).toHaveBeenCalledWith('mine');
    });

    it('offers a reset to the personal default when another pack is applied', async () => {
      const user = userEvent.setup();
      const setModelPack = vi.fn<(packId: string) => Promise<void>>().mockResolvedValue();
      stubModelCatalog(['openai/gpt-5.6-sol']);
      renderPicker({
        models: {
          activeModelId: 'openai/gpt-5.6-sol',
          activeModelPackId: 'mine',
          defaultModelPackId: 'balanced',
          modelPacks: packs,
          setModelPack,
        },
      });

      await user.click(await screen.findByLabelText('Session model'));
      await user.click(await screen.findByRole('option', { name: 'Reset to default pack' }));

      expect(setModelPack).toHaveBeenCalledWith('balanced');
    });

    it('hides the reset while the chat is on the personal default', async () => {
      const user = userEvent.setup();
      stubModelCatalog(['anthropic/claude-sonnet-4-5']);
      renderPicker({
        models: {
          activeModelId: 'anthropic/claude-sonnet-4-5',
          activeModelPackId: 'balanced',
          defaultModelPackId: 'balanced',
          modelPacks: packs,
        },
      });

      await user.click(await screen.findByLabelText('Session model'));

      const manage = await screen.findByRole('option', { name: 'Manage model packs' });
      expect(screen.queryByRole('option', { name: 'Reset to default pack' })).not.toBeInTheDocument();

      await user.click(manage);
      expect(await screen.findByTestId('elsewhere')).toHaveTextContent('/factories/fp-1/settings/models#model-packs');
    });
  });

  describe('when searching inside the picker', () => {
    it('filters models and packs down to matches', async () => {
      const user = userEvent.setup();
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol', 'openai/gpt-4o-mini']);
      renderPicker({
        models: { activeModelId: 'anthropic/claude-sonnet-4-5', defaultModelPackId: 'balanced', modelPacks: packs },
      });

      await user.click(await screen.findByLabelText('Session model'));
      await screen.findByRole('option', { name: 'gpt-4o-mini' });

      await user.type(screen.getByPlaceholderText('Search models and packs…'), 'sonnet');

      expect(await screen.findByRole('option', { name: 'claude-sonnet-4-5' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'gpt-4o-mini' })).not.toBeInTheDocument();
      // The Balanced pack contains the sonnet model, so it stays; Mine does not.
      expect(screen.getByRole('option', { name: /Model pack Balanced/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Model pack Mine/ })).not.toBeInTheDocument();
    });

    it('shows an empty state when nothing matches', async () => {
      const user = userEvent.setup();
      stubModelCatalog(['anthropic/claude-sonnet-4-5']);
      renderPicker({ models: { activeModelId: 'anthropic/claude-sonnet-4-5', modelPacks: packs } });

      await user.click(await screen.findByLabelText('Session model'));
      await user.type(await screen.findByPlaceholderText('Search models and packs…'), 'zzz-nope');

      expect(await screen.findByText('No matching model.')).toBeInTheDocument();
    });
  });

  describe('menu structure for a user chat with packs', () => {
    it('groups models by provider under the current mode and explains the mode scoping', async () => {
      const user = userEvent.setup();
      stubModelCatalog(['openai/gpt-5.6-sol', 'anthropic/claude-sonnet-4-5']);
      renderPicker({ models: { activeModelId: 'anthropic/claude-sonnet-4-5', modelPacks: packs } });

      await user.click(await screen.findByLabelText('Session model'));

      expect(await screen.findByText('anthropic')).toBeInTheDocument();
      expect(screen.getByText('openai')).toBeInTheDocument();
      expect(
        screen.getByText('Model choices apply to Build mode only. Packs set all three modes.'),
      ).toBeInTheDocument();
    });

    it('still explains the mode scoping when no packs are available', async () => {
      const user = userEvent.setup();
      stubModelCatalog(['anthropic/claude-sonnet-4-5']);
      renderPicker({ models: { activeModelId: 'anthropic/claude-sonnet-4-5' } });

      await user.click(await screen.findByLabelText('Session model'));

      expect(await screen.findByText('Model choices apply to Build mode only.')).toBeInTheDocument();
      expect(screen.queryByText(/Packs set all three modes/)).not.toBeInTheDocument();
    });
  });

  describe('when applying a pack to a live thread', () => {
    it('activates the pack for the session through the real provider', async () => {
      let sessionPackId: string | null = null;
      let activateBody: unknown;
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/model-packs`, () =>
          HttpResponse.json({ packs, activePackId: 'balanced', sessionPackId }),
        ),
        http.post(`${TEST_BASE_URL}/web/config/model-packs/mine/activate`, async ({ request }) => {
          activateBody = await request.json();
          sessionPackId = 'mine';
          return HttpResponse.json({ ok: true, target: 'session', sessionPackId: 'mine' });
        }),
      );
      stubModelCatalog(['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol']);

      const user = userEvent.setup();
      const { client } = renderWithProviders(
        <ChatRouter>
          <ChatSessionContext.Provider value={baseSession}>
            <ChatConnectionContext.Provider
              value={{
                status: 'ready',
                state: {
                  controllerId: AGENT_CONTROLLER_ID,
                  resourceId: 'session-1',
                  modeId: 'build',
                  modelId: 'anthropic/claude-sonnet-4-5',
                },
              }}
            >
              <ChatModesContext.Provider value={chatModes}>
                <ChatModelsProvider>
                  <ModelPicker />
                </ChatModelsProvider>
              </ChatModesContext.Provider>
            </ChatConnectionContext.Provider>
          </ChatSessionContext.Provider>
        </ChatRouter>,
      );

      const trigger = await screen.findByLabelText('Session model');
      await waitFor(() => expect(trigger).toHaveAttribute('title', 'anthropic/claude-sonnet-4-5 · Balanced'));

      // The effective model comes from the session-state query; seed it so we
      // can prove activation invalidates it and the model refreshes.
      const stateKey = queryKeys.agentControllerConnectionState(AGENT_CONTROLLER_ID, 'session-1', undefined);
      client.setQueryData(stateKey, { modelId: 'anthropic/claude-sonnet-4-5' });

      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: /Model pack Mine/ }));

      await waitFor(() =>
        expect(activateBody).toEqual({
          target: 'session',
          resourceId: 'session-1',
        }),
      );
      await waitForMutationsIdle(client);
      expect(trigger).toHaveAttribute('title', 'anthropic/claude-sonnet-4-5 · Mine');
      // Activation must force the effective model to refetch — otherwise the
      // picker would keep showing the pre-pack model indefinitely.
      expect(client.getQueryState(stateKey)?.isInvalidated).toBe(true);
    });
  });
});
