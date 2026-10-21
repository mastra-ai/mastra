import type { MastraDBMessage } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import { ChatConnectionContext } from '../../context/ChatConnectionContext';
import { ChatModelsProvider } from '../../context/ChatModelsProvider';
import { ChatTranscriptContext } from '../../context/ChatTranscriptContext';
import type { ConnectionStatus } from '../../hooks/useAgentControllerConnection';
import { useAgentControllerTranscript } from '../../hooks/useAgentControllerTranscript';
import { initialTranscript, transcriptReducer } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';
import type { ThreadOwner } from '../../services/reply-credential';
import { failedReply, modelsWithCredentialHolder, nextUserMessage, runErrorModels } from './fixtures/run-errors';

// cmdk scrolls the highlighted model into view; jsdom has no scrolling implementation.
Element.prototype.scrollIntoView ??= () => {};

type LiveEvent = Extract<Parameters<typeof transcriptReducer>[1], { type: 'event' }>['event'];

function ErrorSession({
  messages,
  liveEvent,
  busy = false,
  connectionStatus = 'ready',
  owner,
}: {
  messages: MastraDBMessage[];
  liveEvent?: LiveEvent;
  busy?: boolean;
  connectionStatus?: ConnectionStatus;
  owner?: ThreadOwner;
}) {
  const api = useAgentControllerTranscript({ initialMessages: messages, initialThreadId: 'thread-1' });
  const entries = liveEvent
    ? transcriptReducer(initialTranscript, { type: 'event', event: liveEvent }).entries
    : api.transcript.entries;
  return (
    <MemoryRouter initialEntries={['/factories/factory-1/sessions/session-1']}>
      <ChatSessionContext.Provider
        value={{
          resourceId: 'session-1',
          sessionThreadId: 'thread-1',
          sessionEnabled: true,
          resourceReady: true,
          sandboxReady: true,
          sandboxPreparing: false,
          resourceEnabled: true,
          baseUrl: TEST_BASE_URL,
          kind: 'user',
          owner,
          factorySessionState: { factoryProjectId: 'factory-1' },
        }}
      >
        <ChatConnectionContext.Provider
          value={{
            status: connectionStatus,
            state: { controllerId: 'code', resourceId: 'session-1', modeId: 'build', modelId: 'openai/gpt-5' },
          }}
        >
          <ChatModelsProvider>
            <ChatTranscriptContext.Provider
              value={{
                ...api,
                busy: busy || api.transcript.pending,
                phase: undefined,
                initializing: false,
                historyInitializing: false,
                loadMore: { hasMore: false, isLoading: false },
              }}
            >
              <TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />
            </ChatTranscriptContext.Provider>
          </ChatModelsProvider>
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>
    </MemoryRouter>
  );
}

describe('chat run errors', () => {
  beforeEach(() => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () => HttpResponse.json({ modelId: 'openai/gpt-5' })),
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', modelScope: 'user' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({ models: runErrorModels, modelScope: 'user', defaultModelId: 'openai/gpt-5' }),
      ),
    );
  });
  it('explains a generic rejected request without inventing a cause, and preserves copyable diagnostics', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ErrorSession messages={[failedReply()]} />);

    expect(screen.getByText('Model request rejected')).toBeVisible();
    expect(screen.getByText(/specific reason isn’t available here/)).toBeVisible();
    expect(screen.queryByText('AI_APICallError')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();

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

  it('continues a transient failure through the real session API once, preserving the session', async () => {
    const user = userEvent.setup();
    const requests: unknown[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions/session-1/messages`, async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );
    renderWithProviders(<ErrorSession messages={[failedReply('Internal Server Error')]} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(requests).toEqual([{ message: 'Continue from where you stopped.' }]));
    expect(screen.getByText('Continue from where you stopped.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('surfaces a failed continuation even after its button has been removed', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions/session-1/messages`, () =>
        HttpResponse.json({ error: 'Continuation refused' }, { status: 409 }),
      ),
    );
    renderWithProviders(<ErrorSession messages={[failedReply('Internal Server Error')]} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/Continuation refused/)).toBeVisible();
  });

  it.each([
    {
      reason: 'busy',
      busy: true,
      connectionStatus: 'ready' as const,
      messages: [failedReply('Internal Server Error')],
      disabled: true,
    },
    {
      reason: 'reconnecting',
      busy: false,
      connectionStatus: 'reconnecting' as const,
      messages: [failedReply('Internal Server Error')],
      disabled: true,
    },
    {
      reason: 'superseded',
      busy: false,
      connectionStatus: 'ready' as const,
      messages: [failedReply('Internal Server Error'), nextUserMessage],
      disabled: false,
    },
  ])('prevents continuing a $reason failure', ({ busy, connectionStatus, messages, disabled }) => {
    renderWithProviders(<ErrorSession messages={messages} busy={busy} connectionStatus={connectionStatus} />);
    const button = screen.queryByRole('button', { name: 'Continue' });
    if (disabled) expect(button).toBeDisabled();
    else expect(button).not.toBeInTheDocument();
  });

  it('offers credential settings for an exhausted quota instead of retrying it', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', modelScope: 'hybrid' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({ models: [], modelScope: 'user', defaultModelId: null }),
      ),
    );
    renderWithProviders(<ErrorSession messages={[failedReply('insufficient_quota')]} />);

    expect(screen.getByText('Provider quota exhausted')).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Review credentials' })).toHaveAttribute(
      'href',
      '/factories/factory-1/settings/personal-models',
    );
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('matches a rejected provider sign-in on its wire name, not its message', async () => {
    renderWithProviders(
      <ErrorSession messages={[failedReply('Anthropic rejected the stored sign-in.', 'ProviderAuthRequiredError')]} />,
    );

    expect(screen.getByText('Provider sign-in required')).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Review credentials' })).toHaveAttribute(
      'href',
      '/factories/factory-1/settings/personal-models',
    );
  });

  it.each([
    { message: 'context_length_exceeded', title: 'Conversation exceeds the model’s limit' },
    { message: "Unsupported_parameter: 'reasoning.effort'", title: 'Model configuration rejected' },
  ])('changes this session’s model for $message', async ({ message, title }) => {
    const user = userEvent.setup();
    const changes: unknown[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions/session-1/model`, async ({ request }) => {
        changes.push(await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );
    renderWithProviders(<ErrorSession messages={[failedReply(message)]} />);

    expect(screen.getByText(title)).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Change model' }));
    await user.click(await screen.findByRole('option', { name: /Claude Sonnet 4.6/ }));
    await waitFor(() => expect(changes).toEqual([{ modelId: 'anthropic/claude-sonnet-4-6' }]));
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('explains when the session owner must repair a personal credential', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, user: { userId: 'viewer', organizationId: 'org-1' } }),
      ),
    );
    renderWithProviders(
      <ErrorSession owner={{ id: 'owner', name: 'Damien' }} messages={[failedReply('invalid_api_key')]} />,
    );

    expect(await screen.findByText('Ask Damien to review the credentials used by this session.')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Review credentials' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('sends the credential owner to their own model settings', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, user: { userId: 'owner', organizationId: 'org-1' } }),
      ),
    );
    renderWithProviders(
      <ErrorSession owner={{ id: 'owner', name: 'Damien' }} messages={[failedReply('invalid_api_key')]} />,
    );

    expect(await screen.findByRole('link', { name: 'Review credentials' })).toHaveAttribute(
      'href',
      '/factories/factory-1/settings/personal-models',
    );
  });

  it('directs a server credential failure to the administrator', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({
          models: modelsWithCredentialHolder('deployment'),
          modelScope: 'user',
          defaultModelId: 'openai/gpt-5',
        }),
      ),
    );
    renderWithProviders(<ErrorSession messages={[failedReply('invalid_api_key')]} />);

    expect(await screen.findByText(/This model uses server credentials/)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Review credentials' })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
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

  it('links an organization credential to organization settings even in a personal-scoped session', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, user: { userId: 'viewer', organizationId: 'org-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({
          models: modelsWithCredentialHolder('organization'),
          modelScope: 'user',
          defaultModelId: 'openai/gpt-5',
        }),
      ),
    );
    renderWithProviders(
      <ErrorSession owner={{ id: 'owner', name: 'Damien' }} messages={[failedReply('invalid_api_key')]} />,
    );

    expect(await screen.findByRole('link', { name: 'Review credentials' })).toHaveAttribute(
      'href',
      '/factories/factory-1/settings/models',
    );
  });

  it('explains a missing run identity without offering a provider login or continuation', () => {
    renderWithProviders(
      <ErrorSession
        messages={[
          failedReply(
            'Tenant model credential policy could not be resolved: the request has no authenticated user.',
            'Error',
          ),
        ]}
      />,
    );

    expect(screen.getByText('Run started without an authenticated user')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Review credentials' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('keeps an unrelated error readable instead of labeling it as a provider problem', () => {
    renderWithProviders(<ErrorSession messages={[failedReply('Database connection refused', 'StorageError')]} />);

    expect(screen.getByText('Run stopped')).toBeVisible();
    expect(screen.getByText('Database connection refused')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
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
