import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { thinkingConfig } from '../../../../__tests__/fixtures/thinkingConfig';
import { AGENT_CONTROLLER_ID } from '../../services/constants';
import { ChatConnectionContext } from '../ChatConnectionContext';
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

function ErrorProbe() {
  const { error } = useChatModels();
  return <div>{error ? 'error' : 'ok'}</div>;
}

function ModelsProviderInBuildMode({ children }: { children: ReactNode }) {
  return (
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
      <ChatModelsProvider>{children}</ChatModelsProvider>
    </ChatModesContext.Provider>
  );
}

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/thinking`, () => HttpResponse.json(thinkingConfig)),
    http.get(`${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: AGENT_CONTROLLER_ID,
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-5',
        settings: { yolo: false, notifications: 'off', smartEditing: true },
      }),
    ),
  );
});

describe('ChatModelsProvider', () => {
  it('uses the personal default model ahead of the Factory default for a new chat', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', defaultModelId: 'openrouter/fable-5' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: 'anthropic/claude-opus-4-1' }),
      ),
    );

    renderWithProviders(
      <ChatSessionContext.Provider value={draftSession}>
        <ModelsProviderInBuildMode>
          <ActiveModelProbe />
        </ModelsProviderInBuildMode>
      </ChatSessionContext.Provider>,
    );

    expect(await screen.findByText('anthropic/claude-opus-4-1')).toBeVisible();
  });

  it('keeps a new chat loading until the personal default resolves', async () => {
    let resolveDefault = () => {};
    const defaultPending = new Promise<void>(resolve => {
      resolveDefault = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', defaultModelId: 'openrouter/fable-5' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/default-model`, async () => {
        await defaultPending;
        return HttpResponse.json({ modelId: null });
      }),
    );

    const { client } = renderWithProviders(
      <ChatSessionContext.Provider value={draftSession}>
        <ModelsProviderInBuildMode>
          <LoadingProbe />
        </ModelsProviderInBuildMode>
      </ChatSessionContext.Provider>,
    );

    expect(await screen.findByText('loading')).toBeVisible();
    resolveDefault();
    await waitForMutationsIdle(client);
    expect(screen.getByText('ready')).toBeVisible();
  });

  it('surfaces personal default loading failures instead of treating them as no default', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', defaultModelId: 'openrouter/fable-5' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ error: 'model_defaults_unavailable' }, { status: 503 }),
      ),
    );

    renderWithProviders(
      <ChatSessionContext.Provider value={draftSession}>
        <ModelsProviderInBuildMode>
          <ActiveModelProbe />
          <ErrorProbe />
        </ModelsProviderInBuildMode>
      </ChatSessionContext.Provider>,
    );

    expect(await screen.findByText('openrouter/fable-5')).toBeVisible();
    expect(await screen.findByText('error')).toBeVisible();
  });

  it('uses the live session state model', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: 'anthropic/claude-opus-4-1' }),
      ),
    );
    const liveSession: ChatSessionContextApi = {
      ...draftSession,
      resourceId: 'session-1',
      sessionEnabled: true,
      resourceReady: true,
      resourceEnabled: true,
      draftSessionId: undefined,
    };

    renderWithProviders(
      <ChatSessionContext.Provider value={liveSession}>
        <ChatConnectionContext.Provider
          value={{
            status: 'ready',
            state: {
              controllerId: AGENT_CONTROLLER_ID,
              resourceId: 'session-1',
              modeId: 'build',
              modelId: 'openai/gpt-5',
            },
          }}
        >
          <ModelsProviderInBuildMode>
            <ActiveModelProbe />
          </ModelsProviderInBuildMode>
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>,
    );

    expect(await screen.findByText('openai/gpt-5')).toBeVisible();
  });
});
