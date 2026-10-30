import type { MastraDBMessage } from '@mastra/client-js';
import { ACCOUNT_SWITCH_PART_TYPE, MODEL_FALLBACK_PART_TYPE } from '@mastra/code-sdk/auth/account-switch';
import type { AccountSwitchPartData, ModelFallbackPartData } from '@mastra/code-sdk/auth/account-switch';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { ChatConnectionContext } from '../../context/ChatConnectionContext';
import { ChatModelsProvider } from '../../context/ChatModelsProvider';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import { ChatTranscriptContext } from '../../context/ChatTranscriptContext';
import { useAgentControllerTranscript } from '../../hooks/useAgentControllerTranscript';
import { TranscriptEntries } from '../Transcript';

type Part = MastraDBMessage['content']['parts'][number];

function reply(parts: Array<Part | { type: string; data: unknown }>): MastraDBMessage {
  return {
    id: 'routed-reply',
    role: 'assistant',
    createdAt: new Date('2026-10-30T10:00:00Z'),
    // Persisted custom data parts are not members of the typed part union.
    content: { format: 2, parts: parts as Part[] },
  };
}

function accountSwitch(data: Partial<AccountSwitchPartData>) {
  return {
    type: ACCOUNT_SWITCH_PART_TYPE,
    data: {
      provider: 'anthropic',
      from: { id: 'anthropic:a', label: 'Work Max' },
      to: { id: 'anthropic:b', label: 'Personal Pro' },
      reason: 'rate-limit',
      at: '2026-10-30T10:00:00Z',
      ...data,
    },
  };
}

function modelFallback(data: Partial<ModelFallbackPartData>) {
  return {
    type: MODEL_FALLBACK_PART_TYPE,
    data: {
      from: { entryId: 'primary', label: 'Claude Opus' },
      to: { entryId: 'backup', label: 'GPT-5.5' },
      reason: 'pool-exhausted',
      at: '2026-10-30T10:00:00Z',
      ...data,
    },
  };
}

function Session({ messages }: { messages: MastraDBMessage[] }) {
  const { transcript, localUser, failLocalUser, clearPending, pushNotice } = useAgentControllerTranscript({
    initialThreadId: 'thread-1',
    initialMessages: messages,
  });
  return (
    <MemoryRouter initialEntries={['/factories/factory-1/sessions/session-1']}>
      <ChatSessionContext.Provider
        value={{
          sessionId: 'session-1',
          resourceId: 'resource-1',
          sessionThreadId: 'thread-1',
          sessionEnabled: true,
          resourceReady: true,
          sandboxReady: true,
          sandboxPreparing: false,
          resourceEnabled: true,
          baseUrl: TEST_BASE_URL,
          kind: 'user',
          factorySessionState: { factoryProjectId: 'factory-1' },
        }}
      >
        <ChatConnectionContext.Provider
          value={{
            status: 'ready',
            threadId: 'thread-1',
            state: {
              controllerId: 'code',
              sessionId: 'session-1',
              resourceId: 'resource-1',
              modeId: 'build',
              modelId: 'anthropic/claude-opus-4-6',
            },
          }}
        >
          <ChatTranscriptContext.Provider
            value={{
              transcript,
              busy: false,
              phase: 'awaiting',
              initializing: false,
              historyInitializing: false,
              initialHistoryReady: true,
              localUser,
              failLocalUser,
              reset: () => {},
              resolvePrompt: () => {},
              clearPending,
              pushNotice,
              loadMore: { hasMore: false, isLoading: false },
            }}
          >
            <ChatModelsProvider>
              <TranscriptEntries entries={transcript.entries} onApprove={() => {}} onRespond={() => {}} />
            </ChatModelsProvider>
          </ChatTranscriptContext.Provider>
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>
    </MemoryRouter>
  );
}

describe('transcript routing notices', () => {
  beforeEach(() => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', modelScope: 'user' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({ models: [], modelScope: 'user', defaultModelId: null }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: null, thinkingLevel: null }),
      ),
    );
  });

  it('names the account routing switched to, alongside the reply', async () => {
    renderWithProviders(<Session messages={[reply([accountSwitch({}), { type: 'text', text: 'Done.' }])]} />);

    expect(await screen.findByText('Switched Anthropic account: Work Max → Personal Pro (rate limit)')).toBeVisible();
    expect(screen.getByText('Done.')).toBeVisible();
  });

  it('renders a notice-only reply that would otherwise draw nothing', async () => {
    renderWithProviders(<Session messages={[reply([accountSwitch({ to: null, reason: 'pool-exhausted' })])]} />);

    expect(await screen.findByText('All Anthropic accounts unavailable (pool exhausted)')).toBeVisible();
  });

  it('distinguishes a pinned account from an exhausted pool', async () => {
    renderWithProviders(
      <Session messages={[reply([accountSwitch({ to: null, reason: 'auth-failed', exclusive: true })])]} />,
    );

    expect(await screen.findByText('Pinned Anthropic account unavailable (auth failed)')).toBeVisible();
    expect(screen.queryByText(/All Anthropic accounts unavailable/)).not.toBeInTheDocument();
  });

  it('reports an unreadable destination as unknown rather than as exhaustion', async () => {
    renderWithProviders(<Session messages={[reply([accountSwitch({ to: { id: 7 } as never })])]} />);

    expect(await screen.findByText('Switched Anthropic account: Work Max → unknown (rate limit)')).toBeVisible();
  });

  it('names the model route a fallback moved to', async () => {
    renderWithProviders(<Session messages={[reply([modelFallback({}), { type: 'text', text: 'Continuing.' }])]} />);

    expect(await screen.findByText('Switched model route: Claude Opus → GPT-5.5 (pool exhausted)')).toBeVisible();
  });

  it('drops parts with reasons this build does not understand', async () => {
    renderWithProviders(
      <Session
        messages={[
          reply([
            accountSwitch({ reason: 'toString' as never }),
            modelFallback({ reason: 'rate-limit' as never }),
            { type: 'text', text: 'Still here.' },
          ]),
        ]}
      />,
    );

    expect(await screen.findByText('Still here.')).toBeVisible();
    expect(screen.queryByText(/Switched/)).not.toBeInTheDocument();
  });
});
