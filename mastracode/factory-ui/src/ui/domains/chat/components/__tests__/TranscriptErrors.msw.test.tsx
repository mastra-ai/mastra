import type { MastraDBMessage } from '@mastra/client-js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import { ChatConnectionContext } from '../../context/ChatConnectionContext';
import { ChatModelsContext } from '../../context/ChatModelsContext';
import { ChatTranscriptContext } from '../../context/ChatTranscriptContext';
import { useAgentControllerTranscript } from '../../hooks/useAgentControllerTranscript';
import { initialTranscript, transcriptReducer } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

type LiveEvent = Extract<Parameters<typeof transcriptReducer>[1], { type: 'event' }>['event'];

const SIGN_IN_REJECTED = 'Anthropic rejected the stored sign-in.';

function failedReply(
  message = 'Bad Request',
  name = 'AI_APICallError',
  facts: { statusCode?: number; responseBody?: string } = {},
): MastraDBMessage {
  return {
    id: 'failed-reply',
    role: 'assistant',
    createdAt: new Date('2026-10-19T10:00:00Z'),
    content: { format: 2, parts: [{ type: 'error', error: { name, message, ...facts } }] },
  };
}

const setModel = vi.fn(async (_modelId: string) => {});

function ErrorSession({ messages, liveEvent }: { messages: MastraDBMessage[]; liveEvent?: LiveEvent }) {
  const api = useAgentControllerTranscript({ initialMessages: messages, initialThreadId: 'thread-1' });
  const entries = liveEvent
    ? transcriptReducer(initialTranscript, { type: 'event', event: liveEvent }).entries
    : api.transcript.entries;
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
            state: {
              controllerId: 'code',
              sessionId: 'session-1',
              resourceId: 'resource-1',
              modeId: 'build',
              modelId: 'openai/gpt-5',
            },
          }}
        >
          <ChatModelsContext.Provider
            value={{
              activeModelId: 'openai/gpt-5.5',
              defaultModelId: undefined,
              isLoading: false,
              error: undefined,
              setModel,
            }}
          >
            <ChatTranscriptContext.Provider
              value={{
                ...api,
                busy: api.transcript.pending,
                phase: undefined,
                initializing: false,
                historyInitializing: false,
                loadMore: { hasMore: false, isLoading: false },
              }}
            >
              <TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />
            </ChatTranscriptContext.Provider>
          </ChatModelsContext.Provider>
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>
    </MemoryRouter>
  );
}

describe('chat run errors', () => {
  beforeEach(() => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', modelScope: 'user' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({ models: [], modelScope: 'user', defaultModelId: null }),
      ),
    );
  });

  it('explains a generic rejected request without inventing a cause, and preserves copyable diagnostics', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ErrorSession messages={[failedReply()]} />);

    expect(screen.getByText('Model request rejected')).toBeVisible();
    expect(screen.getByText(/specific reason isn’t available here/)).toBeVisible();
    expect(screen.queryByText('AI_APICallError')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Error details' }));
    expect(await screen.findByText(/AI_APICallError/)).toBeVisible();
    const copyButton = screen.getByRole('button', { name: 'Copy error details' });
    await user.click(copyButton);
    await user.unhover(copyButton);
    const copied = JSON.parse(await navigator.clipboard.readText());
    expect(copied).toMatchObject({
      name: 'AI_APICallError',
      message: 'Bad Request',
      entryId: 'failed-reply',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });
  });

  it.each([
    { source: 'saved reply', messages: [failedReply(SIGN_IN_REJECTED, 'ProviderAuthRequiredError')] },
    {
      source: 'live error event',
      messages: [],
      liveEvent: { type: 'error', error: { name: 'ProviderAuthRequiredError', message: SIGN_IN_REJECTED } } as const,
    },
  ])('links a rejected provider sign-in from a $source to the credentials', async ({ messages, liveEvent }) => {
    renderWithProviders(<ErrorSession messages={messages} liveEvent={liveEvent} />);

    expect(screen.getByText('Provider sign-in required')).toBeVisible();
    expect(screen.getByText(SIGN_IN_REJECTED)).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Review credentials' })).toHaveAttribute(
      'href',
      '/factories/factory-1/settings/models#personal-defaults',
    );
  });

  it('quotes a refused model and switches the session to another one from the card', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({
          models: [
            { id: 'openai/gpt-5.5', provider: 'openai', modelName: 'gpt-5.5', hasApiKey: true },
            { id: 'openai/gpt-5.4', provider: 'openai', modelName: 'gpt-5.4', hasApiKey: true },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ErrorSession
        messages={[
          failedReply('Bad Request', 'AI_APICallError', {
            statusCode: 400,
            responseBody: JSON.stringify({
              detail: "The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.",
            }),
          }),
        ]}
      />,
    );

    expect(screen.getByText('Model not available')).toBeVisible();
    expect(
      screen.getByText(/The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account\./),
    ).toBeVisible();

    await user.click(await screen.findByRole('button', { name: 'Change model' }));
    await user.click(await screen.findByRole('option', { name: /gpt-5\.4/ }));

    expect(setModel).toHaveBeenCalledExactlyOnceWith('openai/gpt-5.4');
  });

  it('uses the same explanation for a live error event', () => {
    const { entries } = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'error', error: { name: 'AI_APICallError', message: 'Bad Request' } },
    });
    renderWithProviders(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />);

    expect(screen.getByText('Model request rejected')).toBeVisible();
  });

  it('classifies a live error by the status the server kept, not by its message alone', () => {
    renderWithProviders(
      <ErrorSession
        messages={[]}
        liveEvent={{ type: 'error', error: { name: 'AI_APICallError', message: 'Bad Request', statusCode: 403 } }}
      />,
    );

    expect(screen.getByText('Provider access failed')).toBeVisible();
  });
});
