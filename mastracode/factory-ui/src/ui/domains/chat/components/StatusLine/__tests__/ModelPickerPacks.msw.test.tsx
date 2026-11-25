import type { ModelPack, ModelSelectionRequest, ResolvedModelSelection } from '@mastra/factory/model-packs';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import type { SessionModelCatalog } from '../../../../../../hooks/useSessionModelCatalog';
import type { SessionModelResponse, SessionModelTarget } from '../../../../../../hooks/useSessionModel';
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

type SessionModelRequest = SessionModelTarget & { selection: ModelSelectionRequest };

const API = `${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}`;
const models: AvailableModelOption[] = [
  { id: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', modelName: 'claude-sonnet-4-6', hasApiKey: true },
  {
    id: 'openai/gpt-5',
    provider: 'openai',
    modelName: 'gpt-5',
    hasApiKey: true,
    reasoningOptions: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high'] }],
  },
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

function resolvedSelection(selection: ModelSelectionRequest): ResolvedModelSelection {
  if (selection.kind === 'model') return { kind: 'model' };
  return { kind: 'pack', packId: selection.kind === 'pack' ? selection.packId : build.id };
}

function renderPicker({ modelId, modelSelection }: { modelId: string; modelSelection: ResolvedModelSelection }) {
  const requests: SessionModelRequest[] = [];
  let catalogReads = 0;
  let thinkingLevel: string | undefined;
  const catalog: SessionModelCatalog = {
    modelScope: 'user',
    personalThinkingLevel: null,
    modelPacks: [build, quick],
    defaultModelPackId: build.id,
    modelSelection,
    models,
  };
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({
        modelId: null,
        thinkingLevel: null,
        modelPacks: [build, quick],
        defaultModelPackId: build.id,
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () => {
      catalogReads += 1;
      return HttpResponse.json(catalog);
    }),
    http.put<never, SessionModelRequest>(`${TEST_BASE_URL}/web/config/session-model`, async ({ request }) => {
      const body = await request.json();
      requests.push(body);
      catalog.modelSelection = resolvedSelection(body.selection);
      if (body.selection.kind === 'model') thinkingLevel = body.selection.thinkingLevel;
      const saved: SessionModelResponse = { modelSelection: catalog.modelSelection };
      return HttpResponse.json(saved);
    }),
    http.get(`${API}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: AGENT_CONTROLLER_ID,
        resourceId: params.resourceId,
        modeId: 'build',
        modelId,
        settings: { yolo: false, thinkingLevel, notifications: 'off', smartEditing: true },
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
  return { ...rendered, requests, catalogReads: () => catalogReads };
}

async function openPacks(user: UserEvent) {
  const trigger = await screen.findByLabelText('Session model');
  await waitFor(() => expect(trigger).toBeEnabled());
  if (trigger.getAttribute('aria-expanded') !== 'true') await user.click(trigger);
  return screen.findByRole('region', { name: 'Packs' });
}

function checkedModels(): string[] {
  return screen
    .getAllByRole('option')
    .filter(option => option.lastElementChild?.tagName.toLowerCase() === 'svg')
    .map(option => option.getAttribute('data-value') ?? '');
}

describe('ModelPicker packs', () => {
  it('names the default pack and its first model on the trigger and checks only the pack', async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'anthropic/claude-sonnet-4-6', modelSelection: { kind: 'pack', packId: build.id } });

    const trigger = await screen.findByLabelText('Session model');
    await waitFor(() => expect(within(trigger).getByText('Build')).toBeInTheDocument());
    expect(within(trigger).getByText('Claude Sonnet 4.6')).toBeInTheDocument();
    const packs = await openPacks(user);
    const buildPack = within(packs).getByRole('button', { name: 'Build' });
    expect(buildPack).toHaveAttribute('aria-pressed', 'true');
    expect(within(packs).getAllByRole('list', { name: 'Models in this pack' })[0]).toHaveTextContent(
      /Primary model: .*Fallback 1: /,
    );
    expect(within(buildPack).getByText('Default')).toBeInTheDocument();
    expect(within(packs).getByRole('button', { name: 'Quick' })).toHaveAttribute('aria-pressed', 'false');
    expect(checkedModels()).toEqual([]);
    for (const option of screen.getAllByRole('option')) {
      expect(within(option).queryByText('Default')).not.toBeInTheDocument();
    }
  });

  it('checks only the model, with no pack named, when the session runs an exact model', async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'anthropic/claude-sonnet-4-6', modelSelection: { kind: 'model' } });

    const trigger = await screen.findByLabelText('Session model');
    const packs = await openPacks(user);
    expect(within(packs).getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(packs).getByRole('button', { name: 'Quick' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(trigger).queryByText('Build')).not.toBeInTheDocument();
    expect(checkedModels()).toEqual(['anthropic/claude-sonnet-4-6']);
  });

  it("never checks a pack's first model alongside the pack", async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'openai/gpt-5', modelSelection: { kind: 'pack', packId: quick.id } });

    const packs = await openPacks(user);
    expect(within(packs).getByRole('button', { name: 'Quick' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(packs).getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'false');
    expect(checkedModels()).toEqual([]);
  });

  it("runs a pack's first model exactly, at the shown thinking level, when picked from the list", async () => {
    const user = userEvent.setup();
    const { client, requests } = renderPicker({
      modelId: 'anthropic/claude-sonnet-4-6',
      modelSelection: { kind: 'pack', packId: build.id },
    });

    await openPacks(user);
    await user.click(screen.getByRole('option', { name: /Claude Sonnet 4\.6/ }));
    await waitForMutationsIdle(client);

    expect(requests).toEqual([
      {
        resourceId: 'user-1',
        threadId: 'session-1',
        sessionId: 'session-1',
        selection: { kind: 'model', modelId: 'anthropic/claude-sonnet-4-6', thinkingLevel: 'high' },
      },
    ]);
    const trigger = screen.getByLabelText('Session model');
    await waitFor(() => expect(within(trigger).queryByText('Build')).not.toBeInTheDocument());
    const packs = await openPacks(user);
    expect(within(packs).queryAllByRole('button', { pressed: true })).toEqual([]);
    expect(checkedModels()).toEqual(['anthropic/claude-sonnet-4-6']);
  });

  it('switches the running session to a picked pack and reloads its model policy', async () => {
    const user = userEvent.setup();
    const { client, requests, catalogReads } = renderPicker({
      modelId: 'anthropic/claude-sonnet-4-6',
      modelSelection: { kind: 'pack', packId: build.id },
    });

    const packs = await openPacks(user);
    const readsBefore = catalogReads();
    await user.click(within(packs).getByRole('button', { name: 'Quick' }));
    await waitForMutationsIdle(client);

    expect(requests).toEqual([
      {
        resourceId: 'user-1',
        threadId: 'session-1',
        sessionId: 'session-1',
        selection: { kind: 'pack', packId: 'quick' },
      },
    ]);
    await waitFor(() => expect(catalogReads()).toBeGreaterThan(readsBefore));
    const reopened = await openPacks(user);
    expect(within(reopened).getByRole('button', { name: 'Quick' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(reopened).getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('resets a session on another pack to the default selection', async () => {
    const user = userEvent.setup();
    const { client, requests } = renderPicker({
      modelId: 'openai/gpt-5',
      modelSelection: { kind: 'pack', packId: quick.id },
    });

    await openPacks(user);
    await user.click(screen.getByRole('option', { name: 'Reset to your default' }));
    await waitForMutationsIdle(client);

    expect(requests.map(request => request.selection)).toEqual([{ kind: 'default' }]);
  });

  it("runs the pack's first model exactly when the thinking level changes on a pack", async () => {
    const user = userEvent.setup();
    const { client, requests } = renderPicker({
      modelId: 'openai/gpt-5',
      modelSelection: { kind: 'pack', packId: quick.id },
    });

    await openPacks(user);
    expect(await screen.findByRole('group', { name: 'Thinking: Low (Quick pack)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use default' })).not.toBeInTheDocument();
    const ramp = screen.getByRole('slider', { name: 'Thinking' });
    await waitFor(() => expect(ramp).toBeEnabled());
    fireEvent.change(ramp, { target: { value: '3' } });
    fireEvent.keyUp(ramp);
    await waitForMutationsIdle(client);

    expect(requests.map(request => request.selection)).toEqual([
      { kind: 'model', modelId: 'openai/gpt-5', thinkingLevel: 'high' },
    ]);
    const packs = await openPacks(user);
    await waitFor(() => expect(within(packs).queryAllByRole('button', { pressed: true })).toEqual([]));
    expect(checkedModels()).toEqual(['openai/gpt-5']);
    expect(await screen.findByRole('group', { name: 'Thinking: High (this session)' })).toBeInTheDocument();
  });

  it('reports a pack the server no longer has', async () => {
    const user = userEvent.setup();
    renderPicker({ modelId: 'anthropic/claude-sonnet-4-6', modelSelection: { kind: 'pack', packId: build.id } });
    server.use(
      http.put(`${TEST_BASE_URL}/web/config/session-model`, () =>
        HttpResponse.json(
          {
            error: 'model_pack_not_found',
            message: 'That model pack no longer exists. Reopen the model menu to see the current packs.',
          },
          { status: 404 },
        ),
      ),
    );

    const packs = await openPacks(user);
    await user.click(within(packs).getByRole('button', { name: 'Quick' }));

    expect(await screen.findByText(/That model pack no longer exists/)).toBeInTheDocument();
  });
});
