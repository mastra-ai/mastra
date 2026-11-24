import type { ModelPack } from '@mastra/factory/model-packs';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import type { SessionModelCatalog } from '../../../../../../hooks/useSessionModelCatalog';
import type { SessionModelPackRequest, SessionModelPackResponse } from '../../../../../../hooks/useSessionModelPack';
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
  { id: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', modelName: 'claude-sonnet-4-6', hasApiKey: true },
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
];
const build: ModelPack = {
  id: 'build',
  name: 'Build',
  models: [
    { modelId: 'anthropic/claude-sonnet-4-6', thinkingLevel: 'high' },
    { modelId: 'openai/gpt-5', thinkingLevel: 'medium' },
  ],
};
const quick: ModelPack = {
  id: 'quick',
  name: 'Quick',
  models: [{ modelId: 'openai/gpt-5', thinkingLevel: 'low' }],
};
const session: ChatSessionContextApi = {
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

function renderPicker({ modelId, modelPackId = null }: { modelId: string; modelPackId?: string | null }) {
  const packRequests: SessionModelPackRequest[] = [];
  let catalogReads = 0;
  const catalog: SessionModelCatalog = {
    modelScope: 'user',
    defaultModelId: build.models[0].modelId,
    personalThinkingLevel: null,
    modelPacks: [build, quick],
    defaultModelPackId: build.id,
    modelPackId,
    models,
  };
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({
        modelId: build.models[0].modelId,
        thinkingLevel: 'high',
        modelPacks: [build, quick],
        defaultModelPackId: build.id,
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () => {
      catalogReads += 1;
      return HttpResponse.json(catalog);
    }),
    http.put<never, SessionModelPackRequest>(`${TEST_BASE_URL}/web/config/session-model-pack`, async ({ request }) => {
      const body = await request.json();
      packRequests.push(body);
      const started: SessionModelPackResponse = {
        ok: true,
        modelPackId: quick.id,
        modelId: quick.models[0].modelId,
        thinkingLevel: quick.models[0].thinkingLevel,
      };
      return HttpResponse.json(started);
    }),
    http.get(`${API}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: AGENT_CONTROLLER_ID,
        resourceId: params.resourceId,
        modeId: 'build',
        modelId,
        settings: { yolo: false, notifications: 'off', smartEditing: true },
      }),
    ),
  );
  const rendered = renderWithProviders(
    <MemoryRouter>
      <ChatSessionContext.Provider value={session}>
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
    </MemoryRouter>,
  );
  return { ...rendered, packRequests, catalogReads: () => catalogReads };
}

async function openPacks(user: UserEvent) {
  const trigger = await screen.findByLabelText('Session model');
  await waitFor(() => expect(trigger).toBeEnabled());
  await user.click(trigger);
  return screen.findByRole('region', { name: 'Packs' });
}

describe('ModelPicker packs', () => {
  it('names the default pack on the trigger and checks it while the session runs its first model', async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'anthropic/claude-sonnet-4-6' });

    const trigger = await screen.findByLabelText('Session model');
    await waitFor(() => expect(within(trigger).getByText('Build')).toBeInTheDocument());
    const packs = await openPacks(user);
    const buildPack = within(packs).getByRole('button', { name: 'Build' });
    expect(buildPack).toHaveAttribute('aria-pressed', 'true');
    expect(buildPack).toHaveAccessibleDescription(/→/);
    expect(within(buildPack).getByText('Default')).toBeInTheDocument();
    expect(within(packs).getByRole('button', { name: 'Quick' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows no active pack once the session runs a model outside its pack', async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'openai/gpt-5', modelPackId: build.id });

    const trigger = await screen.findByLabelText('Session model');
    const packs = await openPacks(user);
    expect(within(packs).getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(packs).getByRole('button', { name: 'Quick' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(trigger).queryByText('Build')).not.toBeInTheDocument();
  });

  it('checks the session pack the server reports ahead of the default pack', async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'openai/gpt-5', modelPackId: quick.id });

    const packs = await openPacks(user);
    expect(within(packs).getByRole('button', { name: 'Quick' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(packs).getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the running session to a picked pack and reloads its model policy', async () => {
    const user = userEvent.setup();
    const { client, packRequests, catalogReads } = renderPicker({ modelId: 'anthropic/claude-sonnet-4-6' });

    const packs = await openPacks(user);
    const readsBefore = catalogReads();
    await user.click(within(packs).getByRole('button', { name: 'Quick' }));
    await waitForMutationsIdle(client);

    expect(packRequests).toEqual([
      { resourceId: 'user-1', threadId: 'session-1', sessionId: 'session-1', modelPackId: 'quick' },
    ]);
    await waitFor(() => expect(catalogReads()).toBeGreaterThan(readsBefore));
  });

  it('reports a pack the server no longer has', async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'anthropic/claude-sonnet-4-6' });
    server.use(
      http.put(`${TEST_BASE_URL}/web/config/session-model-pack`, () =>
        HttpResponse.json({ error: 'model_pack_not_found' }, { status: 404 }),
      ),
    );

    const packs = await openPacks(user);
    await user.click(within(packs).getByRole('button', { name: 'Quick' }));

    expect(await screen.findByText(/That model pack no longer exists/)).toBeInTheDocument();
  });
});
