import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { AGENT_CONTROLLER_ID } from '../../services/constants';
import { ChatConnectionContext } from '../ChatConnectionContext';
import { ChatModelsProvider } from '../ChatModelsProvider';
import { ChatSessionContext } from '../ChatSessionContext';
import type { ChatSessionContextApi } from '../ChatSessionContext';
import { useChatModels } from '../useChatModels';

const draftSession: ChatSessionContextApi = {
  sessionId: 'draft-1',
  resourceId: 'user-1',
  sessionEnabled: false,
  resourceReady: false,
  sandboxReady: false,
  sandboxPreparing: false,
  resourceEnabled: false,
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

function DefaultModelProbe() {
  const { defaultModelId } = useChatModels();
  return <div data-testid="default-model">{defaultModelId}</div>;
}

function LoadingProbe() {
  const { isLoading } = useChatModels();
  return <div>{isLoading ? 'loading' : 'ready'}</div>;
}

function ErrorProbe() {
  const { error } = useChatModels();
  return <div>{error ? 'error' : 'ok'}</div>;
}

describe('ChatModelsProvider', () => {
  it.each([
    { modelScope: 'factory', kind: 'factory', expected: 'deepseek/deepseek-flash' },
    { modelScope: 'factory', kind: 'user', expected: 'deepseek/deepseek-flash' },
    { modelScope: 'user', kind: 'factory', expected: 'anthropic/claude-opus-4-1' },
    { modelScope: 'user', kind: 'user', expected: 'anthropic/claude-opus-4-1' },
    { modelScope: 'hybrid', kind: 'factory', expected: 'deepseek/deepseek-flash' },
    { modelScope: 'hybrid', kind: 'user', expected: 'anthropic/claude-opus-4-1' },
  ] as const)(
    'uses the $expected default in a $modelScope $kind session without replacing its selected model',
    async ({ modelScope, kind, expected }) => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
          HttpResponse.json({ project: { id: 'factory-1', modelScope, defaultModelId: 'deepseek/deepseek-flash' } }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
          HttpResponse.json({ modelId: 'openai/gpt-5.5', thinkingLevel: null }),
        ),
      );

      server.use(
        http.get(`${TEST_BASE_URL}/web/config/models`, ({ request }) => {
          const params = new URL(request.url).searchParams;
          expect(params.get('resourceId')).toBe('session-1');
          expect(params.get('threadId')).toBe('thread-1');
          return HttpResponse.json({
            models: [],
            modelScope: expected === 'deepseek/deepseek-flash' ? 'factory' : 'user',
            defaultModelId: expected,
          });
        }),
      );

      renderWithProviders(
        <ChatSessionContext.Provider
          value={{
            ...draftSession,
            resourceId: 'session-1',
            sessionThreadId: 'thread-1',
            resourceReady: true,
            kind,
            draftSessionId: undefined,
          }}
        >
          <ChatConnectionContext.Provider
            value={{
              status: 'ready',
              state: {
                controllerId: AGENT_CONTROLLER_ID,
                sessionId: 'session-1',
                resourceId: 'session-1',
                modeId: 'build',
                modelId: 'openai/gpt-5',
              },
            }}
          >
            <ChatModelsProvider>
              <ActiveModelProbe />
              <DefaultModelProbe />
            </ChatModelsProvider>
          </ChatConnectionContext.Provider>
        </ChatSessionContext.Provider>,
      );

      expect(await screen.findByText(expected)).toBeVisible();
      expect(screen.getByText('openai/gpt-5')).toBeVisible();
    },
  );

  it('uses the personal default model ahead of the Factory default for a new chat', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', defaultModelId: 'openrouter/fable-5' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: 'anthropic/claude-opus-4-1', thinkingLevel: null }),
      ),
    );

    renderWithProviders(
      <ChatSessionContext.Provider value={draftSession}>
        <ChatModelsProvider>
          <ActiveModelProbe />
        </ChatModelsProvider>
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
        return HttpResponse.json({ modelId: null, thinkingLevel: null });
      }),
    );

    const { client } = renderWithProviders(
      <ChatSessionContext.Provider value={draftSession}>
        <ChatModelsProvider>
          <LoadingProbe />
        </ChatModelsProvider>
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
        <ChatModelsProvider>
          <ActiveModelProbe />
          <ErrorProbe />
        </ChatModelsProvider>
      </ChatSessionContext.Provider>,
    );

    expect(await screen.findByText('openrouter/fable-5')).toBeVisible();
    expect(await screen.findByText('error')).toBeVisible();
  });

  it('uses the live session state model', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', modelScope: 'user' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: 'anthropic/claude-opus-4-1', thinkingLevel: null }),
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
              sessionId: 'session-1',
              resourceId: 'session-1',
              modeId: 'build',
              modelId: 'openai/gpt-5',
            },
          }}
        >
          <ChatModelsProvider>
            <ActiveModelProbe />
          </ChatModelsProvider>
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>,
    );

    expect(await screen.findByText('openai/gpt-5')).toBeVisible();
  });
});
