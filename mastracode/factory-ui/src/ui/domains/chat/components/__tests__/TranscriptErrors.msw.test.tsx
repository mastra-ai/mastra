import type { MastraDBMessage } from '@mastra/client-js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import { ChatConnectionContext } from '../../context/ChatConnectionContext';
import { ChatTranscriptContext } from '../../context/ChatTranscriptContext';
import { useAgentControllerTranscript } from '../../hooks/useAgentControllerTranscript';
import { initialTranscript, transcriptReducer } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

type LiveEvent = Extract<Parameters<typeof transcriptReducer>[1], { type: 'event' }>['event'];

const SIGN_IN_REJECTED = 'Anthropic rejected the stored sign-in.';

function failedReply(message = 'Bad Request', name = 'AI_APICallError'): MastraDBMessage {
  return {
    id: 'failed-reply',
    role: 'assistant',
    createdAt: new Date('2026-10-19T10:00:00Z'),
    content: { format: 2, parts: [{ type: 'error', error: { name, message } }] },
  };
}

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
          resourceId: 'session-1',
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
              resourceId: 'session-1',
              modeId: 'build',
              modelId: 'openai/gpt-5',
            },
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
      resourceId: 'session-1',
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
  ])('offers Login for a rejected provider sign-in from a $source', async ({ messages, liveEvent }) => {
    renderWithProviders(<ErrorSession messages={messages} liveEvent={liveEvent} />);

    expect(screen.getByText('Provider sign-in required')).toBeVisible();
    expect(screen.getByText(SIGN_IN_REJECTED)).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      '/factories/factory-1/settings/personal-models',
    );
  });

  it('shows a detailed rejection reason instead of claiming it is unavailable', () => {
    renderWithProviders(
      <ErrorSession
        messages={[
          failedReply(
            JSON.stringify({
              error: {
                type: 'invalid_request_error',
                message: 'Invalid schema for function search: required must include query.',
              },
            }),
          ),
        ]}
      />,
    );

    expect(screen.getByText('Invalid schema for function search: required must include query.')).toBeVisible();
    expect(screen.queryByText(/specific reason isn’t available/)).not.toBeInTheDocument();
  });

  it('keeps a rejected parameter terminal even when its value mentions a server error', () => {
    renderWithProviders(
      <ErrorSession
        messages={[
          failedReply(
            JSON.stringify({
              error: { type: 'invalid_request_error', message: "Invalid value 'server_error' for parameter mode." },
            }),
          ),
        ]}
      />,
    );

    expect(screen.getByText("Invalid value 'server_error' for parameter mode.")).toBeVisible();
  });

  it('extracts the reason from a nested Responses failure envelope', () => {
    renderWithProviders(
      <ErrorSession
        messages={[
          failedReply(
            JSON.stringify({
              message: JSON.stringify({
                type: 'response.failed',
                response: {
                  error: {
                    code: 'invalid_request_error',
                    message: 'The request contains an unsupported input format.',
                  },
                },
              }),
            }),
          ),
        ]}
      />,
    );

    expect(screen.getByText('The request contains an unsupported input format.')).toBeVisible();
  });

  it('keeps an unrelated error readable instead of labeling it as a provider problem', () => {
    renderWithProviders(<ErrorSession messages={[failedReply('Database connection refused', 'StorageError')]} />);

    expect(screen.getByText('Run stopped')).toBeVisible();
    expect(screen.getByText('Database connection refused')).toBeVisible();
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
