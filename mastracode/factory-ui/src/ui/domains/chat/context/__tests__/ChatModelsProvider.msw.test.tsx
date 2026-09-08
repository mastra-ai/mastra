import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatModelsProvider } from '../ChatModelsProvider';
import { ChatModesContext } from '../ChatModesContext';
import { ChatSessionContext } from '../ChatSessionContext';
import type { ChatSessionContextApi } from '../ChatSessionContext';
import { useChatModels } from '../useChatModels';

const draftSession: ChatSessionContextApi = {
  resourceId: 'draft-1',
  sessionEnabled: false,
  resourceReady: false,
  sandboxReady: false,
  sandboxPreparing: false,
  resourceEnabled: false,
  projectPath: undefined,
  baseUrl: TEST_BASE_URL,
  kind: 'user',
  draftSessionId: 'draft-1',
  factorySessionState: {
    factoryProjectId: 'factory-1',
    projectRepositoryId: 'repository-1',
  },
};

function ActiveModelProbe() {
  const { activeModelId } = useChatModels();
  return <div>{activeModelId}</div>;
}

function LoadingProbe() {
  const { isLoading } = useChatModels();
  return <div>{isLoading ? 'loading' : 'ready'}</div>;
}

describe('ChatModelsProvider', () => {
  it('uses the personal default pack for a new interactive chat', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', defaultModelId: 'openrouter/fable-5' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/model-packs`, () =>
        HttpResponse.json({
          packs: [
            {
              id: 'mix',
              name: 'Mix',
              description: '',
              models: {
                build: 'anthropic/claude-opus-4-1',
                plan: 'anthropic/claude-sonnet-4',
                fast: 'anthropic/claude-haiku-3-5',
              },
              custom: true,
              active: true,
            },
          ],
          activePackId: 'mix',
          sessionPackId: null,
        }),
      ),
    );

    renderWithProviders(
      <ChatSessionContext.Provider value={draftSession}>
        <ChatModesContext.Provider
          value={{
            modes: [],
            activeMode: undefined,
            activeModeId: 'build',
            isLoading: false,
            error: undefined,
            setMode: async () => {},
          }}
        >
          <ChatModelsProvider>
            <ActiveModelProbe />
          </ChatModelsProvider>
        </ChatModesContext.Provider>
      </ChatSessionContext.Provider>,
    );

    expect(await screen.findByText('anthropic/claude-opus-4-1')).toBeVisible();
  });

  it('keeps a new chat loading until the personal default pack resolves', async () => {
    let resolvePacks = () => {};
    const packsPending = new Promise<void>(resolve => {
      resolvePacks = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', defaultModelId: 'openrouter/fable-5' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/model-packs`, async () => {
        await packsPending;
        return HttpResponse.json({ packs: [], activePackId: null, sessionPackId: null });
      }),
    );

    const { client } = renderWithProviders(
      <ChatSessionContext.Provider value={draftSession}>
        <ChatModesContext.Provider
          value={{
            modes: [],
            activeMode: undefined,
            activeModeId: 'build',
            isLoading: false,
            error: undefined,
            setMode: async () => {},
          }}
        >
          <ChatModelsProvider>
            <LoadingProbe />
          </ChatModelsProvider>
        </ChatModesContext.Provider>
      </ChatSessionContext.Provider>,
    );

    expect(await screen.findByText('loading')).toBeVisible();
    resolvePacks();
    await waitForMutationsIdle(client);
    expect(screen.getByText('ready')).toBeVisible();
  });

  it('falls back to the Factory model when personal pack loading fails', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', defaultModelId: 'openrouter/fable-5' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/model-packs`, () =>
        HttpResponse.json({ error: 'model_packs_unavailable' }, { status: 503 }),
      ),
    );

    renderWithProviders(
      <ChatSessionContext.Provider value={draftSession}>
        <ChatModesContext.Provider
          value={{
            modes: [],
            activeMode: undefined,
            activeModeId: 'build',
            isLoading: false,
            error: undefined,
            setMode: async () => {},
          }}
        >
          <ChatModelsProvider>
            <ActiveModelProbe />
          </ChatModelsProvider>
        </ChatModesContext.Provider>
      </ChatSessionContext.Provider>,
    );

    expect(await screen.findByText('openrouter/fable-5')).toBeVisible();
  });
});
