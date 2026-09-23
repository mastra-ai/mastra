import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import { queryKeys } from '../../../../../../api/keys';
import type { ModelPackInfo } from '../../../../../../api/types';
import { AGENT_CONTROLLER_ID } from '../../../services/constants';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import type { ChatConnectionApi } from '../../../context/ChatConnectionContext';
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

const API = `${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}`;

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

interface HarnessOptions {
  session?: Partial<ChatSessionContextApi>;
  status?: ChatConnectionApi['status'];
  /** Effective session model reported over the live connection. */
  modelId?: string;
  /** Credentialed model catalog. */
  modelIds?: string[];
  packList?: ModelPackInfo[];
  activePackId?: string | null;
  sessionPackId?: string | null;
}

/** Network requests recorded by the MSW handlers. */
interface Recorded {
  modelSwitches: string[];
  activations: { packId: string; body: unknown }[];
}

/**
 * Renders the picker inside the real ChatModelsProvider; every model or pack
 * interaction travels through MSW. Only the network boundary is mocked.
 */
function renderPicker({
  session = {},
  status = 'ready',
  modelId,
  modelIds = [],
  packList = [],
  activePackId = null,
  sessionPackId = null,
}: HarnessOptions = {}) {
  const recorded: Recorded = { modelSwitches: [], activations: [] };
  let currentSessionPackId = sessionPackId;
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/model-packs`, () =>
      HttpResponse.json({ packs: packList, activePackId, sessionPackId: currentSessionPackId }),
    ),
    http.post(`${TEST_BASE_URL}/web/config/model-packs/:packId/activate`, async ({ params, request }) => {
      recorded.activations.push({ packId: String(params.packId), body: await request.json() });
      currentSessionPackId = String(params.packId);
      return HttpResponse.json({ ok: true, target: 'session', sessionPackId: currentSessionPackId });
    }),
    http.post(`${API}/sessions/:resourceId/model`, async ({ request }) => {
      const body = (await request.json()) as { modelId?: string };
      recorded.modelSwitches.push(String(body.modelId));
      return HttpResponse.json({ ok: true });
    }),
  );
  stubModelCatalog(modelIds);
  const merged = { ...baseSession, ...session };
  const rendered = renderWithProviders(
    <ChatRouter>
      <ChatSessionContext.Provider value={merged}>
        <ChatConnectionContext.Provider
          value={{
            status,
            state: modelId
              ? { controllerId: AGENT_CONTROLLER_ID, resourceId: merged.resourceId, modeId: 'build', modelId }
              : undefined,
          }}
        >
          <ChatModesContext.Provider value={chatModes}>
            <ChatModelsProvider>
              <ModelPicker />
              <Toaster position="bottom-right" />
            </ChatModelsProvider>
          </ChatModesContext.Provider>
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>
    </ChatRouter>,
  );
  return { ...rendered, recorded };
}

/** Draft chats have no live session; models resolve from the factory default and packs. */
function renderDraftPicker({
  modelIds = [],
  packList = [],
  activePackId = null,
  defaultModelId,
  projectFails = false,
  status = 'connecting',
}: {
  modelIds?: string[];
  packList?: ModelPackInfo[];
  activePackId?: string | null;
  defaultModelId?: string;
  projectFails?: boolean;
  status?: ChatConnectionApi['status'];
} = {}) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/:projectId`, ({ params }) =>
      projectFails
        ? HttpResponse.json({ error: 'Factory unavailable' }, { status: 500 })
        : HttpResponse.json({ project: { id: params.projectId, defaultModelId } }),
    ),
  );
  return renderPicker({
    session: {
      sessionEnabled: false,
      sandboxReady: false,
      draftSessionId: 'draft-1',
      factorySessionState: { factoryProjectId: 'fp-project-1' },
    },
    status,
    modelIds,
    packList,
    activePackId,
  });
}

describe('ModelPicker', () => {
  describe('when the connection is still resolving and no model id is known yet', () => {
    it('shows a loading skeleton instead of a "No model" label', () => {
      renderPicker({ status: 'connecting' });

      expect(screen.getByLabelText('Loading model')).toBeInTheDocument();
      expect(screen.queryByText('No model')).not.toBeInTheDocument();
    });
  });

  describe('when the draft model fails to resolve', () => {
    it('shows the failure instead of a "No model" label', async () => {
      // 'ready' status: the skeleton must not mask the resolution failure.
      renderDraftPicker({ projectFails: true, status: 'ready' });

      expect(await screen.findByLabelText('Model unavailable')).toBeInTheDocument();
      expect(screen.queryByText('No model')).not.toBeInTheDocument();
    });
  });

  describe('when the connection is ready but reports no model', () => {
    it('falls back to the explicit "No model" label', async () => {
      renderPicker();

      expect(await screen.findByText('No model')).toBeInTheDocument();
      expect(screen.queryByLabelText('Loading model')).not.toBeInTheDocument();
    });
  });

  describe('when the active model is missing from the credentialed catalog', () => {
    it('flags the model as not configured', async () => {
      renderPicker({ modelId: 'anthropic/claude-sonnet-4-5', modelIds: ['openai/gpt-5'] });

      expect(await screen.findByLabelText('Session model, Claude Sonnet 4.5 is not configured')).toBeInTheDocument();
    });
  });

  describe('when there is no session yet — a draft composer', () => {
    it('picks the model the first prompt will create the session on', async () => {
      const user = userEvent.setup();
      renderDraftPicker({
        modelIds: ['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol'],
        defaultModelId: 'anthropic/claude-sonnet-4-5',
      });

      const trigger = await screen.findByLabelText('Session model');
      await waitFor(() => expect(trigger).toHaveTextContent('Claude Sonnet 4.5'));

      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'gpt-5.6-sol' }));

      // The draft holds the choice locally until the first prompt creates the session.
      await waitFor(() => expect(trigger).toHaveTextContent('GPT-5.6 Sol'));
    });
  });

  describe('when a live user chat is ready', () => {
    it('switches the session model from the status line', async () => {
      const user = userEvent.setup();
      const { recorded, client } = renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol'],
      });

      await user.click(await screen.findByLabelText('Session model'));
      await user.click(await screen.findByRole('option', { name: 'gpt-5.6-sol' }));

      await waitForMutationsIdle(client);
      expect(recorded.modelSwitches).toEqual(['openai/gpt-5.6-sol']);
    });

    it('disables the trigger while a switch is pending, then re-enables it', async () => {
      const user = userEvent.setup();
      renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol'],
      });
      // Hold the switch request open so the in-flight state is observable.
      let release: () => void = () => {};
      server.use(
        http.post(
          `${API}/sessions/:resourceId/model`,
          () =>
            new Promise<Response>(resolve => {
              release = () => resolve(HttpResponse.json({ ok: true }));
            }),
        ),
      );

      const trigger = await screen.findByLabelText('Session model');
      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'gpt-5.6-sol' }));

      await waitFor(() => expect(trigger).toBeDisabled());
      expect(trigger).toHaveAttribute('aria-busy', 'true');

      release();
      await waitFor(() => expect(trigger).toBeEnabled());
      expect(trigger).toHaveAttribute('aria-busy', 'false');
    });

    it('surfaces a failed switch and keeps the control usable', async () => {
      const user = userEvent.setup();
      renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol'],
      });
      server.use(
        http.post(`${API}/sessions/:resourceId/model`, () =>
          HttpResponse.json({ error: 'Provider is unavailable' }, { status: 500 }),
        ),
      );

      const trigger = await screen.findByLabelText('Session model');
      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'gpt-5.6-sol' }));

      expect(await screen.findByText(/Provider is unavailable|Failed to switch model/)).toBeInTheDocument();
      await waitFor(() => expect(trigger).toBeEnabled());
      expect(trigger).toHaveTextContent('Claude Sonnet 4.5');
    });
  });

  describe('when the chat is a factory session', () => {
    it('offers models but no packs', async () => {
      const user = userEvent.setup();
      renderPicker({
        session: { kind: 'factory' },
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['anthropic/claude-sonnet-4-5'],
        packList: packs,
        activePackId: 'balanced',
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
      const { recorded, client } = renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol'],
        packList: packs,
        activePackId: 'balanced',
      });

      await user.click(await screen.findByLabelText('Session model'));

      const defaultPack = await screen.findByRole('option', { name: /Model pack Balanced/ });
      expect(defaultPack).toHaveTextContent('Default');
      expect(defaultPack).toHaveTextContent('Claude Sonnet 4.5 · Plan · Fast');

      await user.click(screen.getByRole('option', { name: /Model pack Mine/ }));
      await waitForMutationsIdle(client);
      expect(recorded.activations).toEqual([{ packId: 'mine', body: { target: 'session', resourceId: 'session-1' } }]);
    });

    it('surfaces a failed pack activation and keeps the control usable', async () => {
      const user = userEvent.setup();
      renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['anthropic/claude-sonnet-4-5'],
        packList: packs,
        activePackId: 'balanced',
      });
      server.use(
        http.post(`${TEST_BASE_URL}/web/config/model-packs/:packId/activate`, () =>
          HttpResponse.json({ error: 'Pack storage is unavailable' }, { status: 500 }),
        ),
      );

      const trigger = await screen.findByLabelText('Session model');
      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: /Model pack Mine/ }));

      expect(await screen.findByText('Pack storage is unavailable')).toBeInTheDocument();
      // pendingPackId must clear on failure so another attempt is possible.
      await waitFor(() => expect(trigger).toBeEnabled());
      expect(trigger).toHaveAttribute('aria-busy', 'false');
      expect(trigger).toHaveTextContent('Claude Sonnet 4.5');
    });

    it('keeps packs selectable when no credentialed models are listed', async () => {
      const user = userEvent.setup();
      const { recorded, client } = renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        packList: packs,
        activePackId: 'balanced',
      });

      await user.click(await screen.findByLabelText(/Session model/));

      expect(await screen.findByRole('option', { name: /Model pack Balanced/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Manage model packs' })).toBeInTheDocument();

      await user.click(screen.getByRole('option', { name: /Model pack Mine/ }));
      await waitForMutationsIdle(client);
      expect(recorded.activations.map(({ packId }) => packId)).toEqual(['mine']);
    });

    it('offers a reset to the personal default when another pack is applied', async () => {
      const user = userEvent.setup();
      const { recorded, client } = renderPicker({
        modelId: 'openai/gpt-5.6-sol',
        modelIds: ['openai/gpt-5.6-sol'],
        packList: packs,
        activePackId: 'balanced',
        sessionPackId: 'mine',
      });

      await user.click(await screen.findByLabelText('Session model'));
      await user.click(await screen.findByRole('option', { name: 'Reset to default pack' }));

      await waitForMutationsIdle(client);
      expect(recorded.activations.map(({ packId }) => packId)).toEqual(['balanced']);
    });

    it('hides the reset while the chat is on the personal default', async () => {
      const user = userEvent.setup();
      renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['anthropic/claude-sonnet-4-5'],
        packList: packs,
        activePackId: 'balanced',
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
      renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol', 'openai/gpt-4o-mini'],
        packList: packs,
        activePackId: 'balanced',
      });

      await user.click(await screen.findByLabelText('Session model'));
      await screen.findByRole('option', { name: 'gpt-4o-mini' });
      await screen.findByRole('option', { name: /Model pack Mine/ });

      await user.type(screen.getByPlaceholderText('Search models and packs…'), 'sonnet');

      expect(await screen.findByRole('option', { name: 'claude-sonnet-4-5' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'gpt-4o-mini' })).not.toBeInTheDocument();
      // The Balanced pack contains the sonnet model, so it stays; Mine does not.
      expect(screen.getByRole('option', { name: /Model pack Balanced/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Model pack Mine/ })).not.toBeInTheDocument();
    });

    it('shows an empty state when nothing matches', async () => {
      const user = userEvent.setup();
      renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['anthropic/claude-sonnet-4-5'],
        packList: packs,
        activePackId: 'balanced',
      });

      await user.click(await screen.findByLabelText('Session model'));
      await user.type(await screen.findByPlaceholderText('Search models and packs…'), 'zzz-nope');

      expect(await screen.findByText('No matching model.')).toBeInTheDocument();
    });
  });

  describe('menu structure for a user chat with packs', () => {
    it('groups models by provider under the current mode and explains the mode scoping', async () => {
      const user = userEvent.setup();
      renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['openai/gpt-5.6-sol', 'anthropic/claude-sonnet-4-5'],
        packList: packs,
        activePackId: 'balanced',
      });

      await user.click(await screen.findByLabelText('Session model'));
      await screen.findByRole('option', { name: /Model pack Balanced/ });

      expect(await screen.findByText('anthropic')).toBeInTheDocument();
      expect(screen.getByText('openai')).toBeInTheDocument();
      expect(
        screen.getByText('Model choices apply to Build mode only. Packs set all three modes.'),
      ).toBeInTheDocument();
    });

    it('still explains the mode scoping when no packs are available', async () => {
      const user = userEvent.setup();
      renderPicker({ modelId: 'anthropic/claude-sonnet-4-5', modelIds: ['anthropic/claude-sonnet-4-5'] });

      await user.click(await screen.findByLabelText('Session model'));

      expect(await screen.findByText('Model choices apply to Build mode only.')).toBeInTheDocument();
      expect(screen.queryByText(/Packs set all three modes/)).not.toBeInTheDocument();
    });
  });

  describe('when applying a pack to a live thread', () => {
    it('invalidates the session state so the effective model refreshes', async () => {
      const user = userEvent.setup();
      const { recorded, client } = renderPicker({
        modelId: 'anthropic/claude-sonnet-4-5',
        modelIds: ['anthropic/claude-sonnet-4-5', 'openai/gpt-5.6-sol'],
        packList: packs,
        activePackId: 'balanced',
      });

      const trigger = await screen.findByLabelText('Session model');
      await waitFor(() => expect(trigger).toHaveAttribute('title', 'anthropic/claude-sonnet-4-5 · Balanced'));

      // The effective model comes from the session-state query; seed it so we
      // can prove activation invalidates it and the model refreshes.
      const stateKey = queryKeys.agentControllerConnectionState(AGENT_CONTROLLER_ID, 'session-1', undefined);
      client.setQueryData(stateKey, { modelId: 'anthropic/claude-sonnet-4-5' });

      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: /Model pack Mine/ }));

      await waitFor(() =>
        expect(recorded.activations).toEqual([
          { packId: 'mine', body: { target: 'session', resourceId: 'session-1' } },
        ]),
      );
      await waitForMutationsIdle(client);
      expect(trigger).toHaveAttribute('title', 'anthropic/claude-sonnet-4-5 · Mine');
      // Activation must force the effective model to refetch — otherwise the
      // picker would keep showing the pre-pack model indefinitely.
      expect(client.getQueryState(stateKey)?.isInvalidated).toBe(true);
    });
  });
});
