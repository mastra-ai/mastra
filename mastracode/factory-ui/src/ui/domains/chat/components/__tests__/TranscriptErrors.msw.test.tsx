import type { AgentControllerEvent, MastraDBMessage } from '@mastra/client-js';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { useSwitchAgentControllerThreadMutation } from '../../../../../hooks/useAgentControllerThreadMutations';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import { ChatConnectionContext } from '../../context/ChatConnectionContext';
import { ChatModelsProvider } from '../../context/ChatModelsProvider';
import { ChatTranscriptContext } from '../../context/ChatTranscriptContext';
import { useAgentControllerTranscript } from '../../hooks/useAgentControllerTranscript';
import { AGENT_CONTROLLER_ID } from '../../services/constants';
import { TranscriptEntries } from '../Transcript';

const SIGN_IN_REJECTED = 'Anthropic rejected the stored sign-in.';

function failedReply(
  message = 'Bad Request',
  name = 'AI_APICallError',
  facts: { statusCode?: number; responseBody?: string; modelId?: string } = {},
): MastraDBMessage {
  return {
    id: 'failed-reply',
    role: 'assistant',
    createdAt: new Date('2026-10-19T10:00:00Z'),
    content: { format: 2, parts: [{ type: 'error', error: { name, message, ...facts } }] },
  };
}

function userMessage(text: string): MastraDBMessage {
  return {
    id: 'later-user-message',
    role: 'user',
    createdAt: new Date('2026-10-19T10:01:00Z'),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function ErrorSession({
  messages,
  liveEvent,
  boundThreadId = 'thread-1',
  modelId = 'openai/gpt-5.5',
}: {
  messages: MastraDBMessage[];
  liveEvent?: AgentControllerEvent;
  boundThreadId?: string;
  modelId?: string;
}) {
  const { transcript, onEvent, localUser, failLocalUser, clearPending, pushNotice } = useAgentControllerTranscript({
    initialThreadId: 'thread-1',
    initialMessages: messages,
  });
  useEffect(() => {
    if (liveEvent) onEvent(liveEvent);
  }, [liveEvent, onEvent]);
  const session = (
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
          threadId: boundThreadId,
          state: {
            controllerId: 'code',
            sessionId: 'session-1',
            resourceId: 'resource-1',
            modeId: 'build',
            modelId,
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
  );
  return (
    <MemoryRouter initialEntries={['/factories/factory-1/sessions/session-1']}>
      <Routes>
        <Route path="/factories/:factoryId/user/new/:draftSessionId" element={<p>New session draft</p>} />
        <Route path="*" element={session} />
      </Routes>
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
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: null, thinkingLevel: null }),
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
    const details = await screen.findByRole('dialog', { name: 'Error details' });
    expect(within(details).getByText(/AI_APICallError/)).toBeVisible();
    const copyButton = within(details).getByRole('button', { name: 'Copy error details' });
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
    const modelSwitches: unknown[] = [];
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/sessions/:sessionId/model`,
        async ({ request }) => {
          modelSwitches.push(await request.json());
          return HttpResponse.json({ ok: true });
        },
      ),
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

    await waitFor(() => expect(modelSwitches).toEqual([{ modelId: 'openai/gpt-5.4' }]));
  });

  it.each([
    {
      title: 'Provider access failed',
      model: 'GPT-5.5',
      reply: failedReply('Incorrect API key provided.', 'AI_APICallError', { statusCode: 401, modelId: 'gpt-5.5' }),
    },
    {
      title: 'Provider rate limit reached',
      model: 'Claude Opus 5.5',
      reply: failedReply(
        "This request would exceed your account's rate limit. Please try again later.",
        'AI_APICallError',
        {
          statusCode: 429,
          modelId: 'claude-opus-5-5',
          responseBody: JSON.stringify({
            type: 'error',
            error: {
              type: 'rate_limit_error',
              message: "This request would exceed your account's rate limit. Please try again later.",
            },
          }),
        },
      ),
    },
  ])(
    'names the model behind $title and offers another model next to the credentials',
    async ({ title, model, reply }) => {
      const modelSwitches: unknown[] = [];
      server.use(
        http.post(
          `${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/sessions/:sessionId/model`,
          async ({ request }) => {
            modelSwitches.push(await request.json());
            return HttpResponse.json({ ok: true });
          },
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: [
              { id: 'openai/gpt-5.5', provider: 'openai', modelName: 'gpt-5.5', hasApiKey: true },
              { id: 'anthropic/claude-opus-4-5', provider: 'anthropic', modelName: 'claude-opus-4-5', hasApiKey: true },
            ],
          }),
        ),
      );
      const user = userEvent.setup();
      renderWithProviders(<ErrorSession messages={[reply]} />);

      expect(screen.getByText(title)).toBeVisible();
      expect(screen.getByText(`Model: ${model}`)).toBeVisible();
      expect(await screen.findByRole('link', { name: 'Review credentials' })).toBeVisible();

      await user.click(await screen.findByRole('button', { name: 'Change model' }));
      await user.click(await screen.findByRole('option', { name: /claude-opus-4-5/ }));

      await waitFor(() => expect(modelSwitches).toEqual([{ modelId: 'anthropic/claude-opus-4-5' }]));
    },
  );

  it('classifies a live error by the status the server kept, not by its message alone', () => {
    renderWithProviders(
      <ErrorSession
        messages={[]}
        liveEvent={{ type: 'error', error: { name: 'AI_APICallError', message: 'Bad Request', statusCode: 403 } }}
      />,
    );

    expect(screen.getByText('Provider access failed')).toBeVisible();
  });

  it('continues a timed-out run from the card', async () => {
    const sentMessages: unknown[] = [];
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/sessions/:sessionId/messages`,
        async ({ request }) => {
          sentMessages.push(await request.json());
          return HttpResponse.json({ ok: true });
        },
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ErrorSession messages={[failedReply('Request timed out.')]} />);

    expect(screen.getByText('Request timed out')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(sentMessages).toMatchObject([{ message: 'Continue from where you stopped.' }]));
  });

  it.each([
    { source: 'saved reply', messages: [failedReply('Request timed out.')] },
    {
      source: 'live error event',
      messages: [],
      liveEvent: { type: 'error', error: { name: 'AI_APICallError', message: 'Request timed out.' } } as const,
    },
  ])('offers Continue again on a $source when sending it fails', async ({ messages, liveEvent }) => {
    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/sessions/:sessionId/messages`, () =>
        HttpResponse.json({ error: 'Session is busy' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ErrorSession messages={messages} liveEvent={liveEvent} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/Session is busy/)).toBeVisible();
    expect(screen.queryByText('Continue from where you stopped.')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
  });

  it.each([
    {
      when: 'a later message follows the failure',
      messages: [failedReply('Request timed out.'), userMessage('Try a smaller change instead.')],
      boundThreadId: 'thread-1',
    },
    {
      when: 'the session is still bound to the thread it is switching away from',
      messages: [failedReply('Request timed out.')],
      boundThreadId: 'thread-0',
    },
  ])('withholds Continue when $when', ({ messages, boundThreadId }) => {
    renderWithProviders(<ErrorSession messages={messages} boundThreadId={boundThreadId} />);

    expect(screen.getByText('Request timed out')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('holds Continue while a thread switch is in flight, since the server may already be on the next thread', async () => {
    let finishSwitch = () => {};
    const switchHeld = new Promise<void>(resolve => {
      finishSwitch = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/sessions/:sessionId/thread`, async () => {
        await switchHeld;
        return HttpResponse.json({ ok: true });
      }),
      http.get(`${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/sessions/:sessionId`, () =>
        HttpResponse.json({ controllerId: 'code', resourceId: 'resource-1', threadId: 'thread-1' }),
      ),
    );
    function ThreadSwitch() {
      const { mutate } = useSwitchAgentControllerThreadMutation({
        agentControllerId: AGENT_CONTROLLER_ID,
        sessionId: 'session-1',
        baseUrl: TEST_BASE_URL,
      });
      useEffect(() => mutate('thread-1'), [mutate]);
      return null;
    }
    renderWithProviders(
      <>
        <ThreadSwitch />
        <ErrorSession messages={[failedReply('Request timed out.')]} />
      </>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled());
    finishSwitch();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
  });

  it('opens a new session when the provider rejects the conversation history', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ErrorSession messages={[failedReply('No tool output found for function call call_abc123.')]} />,
    );

    expect(screen.getByText('Conversation history rejected')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'New session' }));

    expect(await screen.findByText('New session draft')).toBeVisible();
  });
});

describe('chat run errors on an account limit', () => {
  const rateLimited = failedReply(
    "This request would exceed your account's rate limit. Please try again later.",
    'AI_APICallError',
    { statusCode: 429, modelId: 'claude-opus-5-5' },
  );

  function stubCredential(credentialHolder: 'organization' | 'personal') {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({
          authenticated: true,
          user: { userId: 'user-damien', name: 'Damien Schneider', organizationId: 'org-1' },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', modelScope: 'hybrid' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: null, thinkingLevel: null }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({
          models: [
            {
              id: 'anthropic/claude-opus-5-5',
              provider: 'anthropic',
              modelName: 'claude-opus-5-5',
              hasApiKey: true,
              credentialLabel: 'Claude Pro/Max',
              credentialHolder,
            },
            {
              id: 'openai/gpt-5.5',
              provider: 'openai',
              modelName: 'gpt-5.5',
              hasApiKey: true,
              credentialLabel: 'ChatGPT Plus/Pro',
              credentialHolder,
            },
          ],
          modelScope: credentialHolder === 'organization' ? 'factory' : 'user',
          defaultModelId: null,
        }),
      ),
    );
  }

  it('tells a work-item reviewer the limit belongs to the organization’s subscription, not theirs', async () => {
    stubCredential('organization');
    renderWithProviders(<ErrorSession messages={[rateLimited]} modelId="anthropic/claude-opus-5-5" />);

    expect(await screen.findByText('Runs on Claude Pro/Max · Shared by the organization')).toBeVisible();
  });

  it('tells the chat owner the limit belongs to their own subscription', async () => {
    stubCredential('personal');
    renderWithProviders(<ErrorSession messages={[rateLimited]} modelId="anthropic/claude-opus-5-5" />);

    expect(await screen.findByText('Runs on Claude Pro/Max · Damien Schneider (you)')).toBeVisible();
  });

  it('does not name a credential on an older failure, which may predate a credential change', async () => {
    stubCredential('organization');
    const { client } = renderWithProviders(
      <ErrorSession messages={[rateLimited, userMessage('Try again.')]} modelId="anthropic/claude-opus-5-5" />,
    );

    expect(await screen.findByRole('link', { name: 'Review credentials' })).toBeVisible();
    await waitForMutationsIdle(client);
    expect(screen.queryByText(/^Runs on/)).not.toBeInTheDocument();
  });

  it('stops naming the failed model’s credential once the session switches to another provider', async () => {
    const modelSwitches: unknown[] = [];
    stubCredential('organization');
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/sessions/:sessionId/model`,
        async ({ request }) => {
          modelSwitches.push(await request.json());
          return HttpResponse.json({ ok: true });
        },
      ),
    );
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <ErrorSession messages={[rateLimited]} modelId="anthropic/claude-opus-5-5" />,
    );
    expect(await screen.findByText('Runs on Claude Pro/Max · Shared by the organization')).toBeVisible();

    await user.click(await screen.findByRole('button', { name: 'Change model' }));
    await user.click(await screen.findByRole('option', { name: /gpt-5\.5/i }));
    await waitFor(() => expect(modelSwitches).toEqual([{ modelId: 'openai/gpt-5.5' }]));
    rerender(<ErrorSession messages={[rateLimited]} modelId="openai/gpt-5.5" />);

    expect(screen.getByText('Provider rate limit reached')).toBeVisible();
    expect(screen.queryByText(/^Runs on/)).not.toBeInTheDocument();
  });

  it('names no credential when another provider serves the same model name the session moved to', async () => {
    stubCredential('organization');
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({
          models: [
            {
              id: 'openai-codex/gpt-5.5',
              provider: 'openai-codex',
              modelName: 'gpt-5.5',
              hasApiKey: true,
              credentialLabel: 'ChatGPT Plus/Pro',
              credentialHolder: 'organization',
            },
            {
              id: 'openai/gpt-5.5',
              provider: 'openai',
              modelName: 'gpt-5.5',
              hasApiKey: true,
              credentialLabel: 'OpenAI API key',
              credentialHolder: 'organization',
            },
          ],
          modelScope: 'factory',
          defaultModelId: null,
        }),
      ),
    );
    const codexLimited = failedReply('Rate limit reached for gpt-5.5.', 'AI_APICallError', {
      statusCode: 429,
      modelId: 'gpt-5.5',
    });
    const { client } = renderWithProviders(<ErrorSession messages={[codexLimited]} modelId="openai/gpt-5.5" />);

    expect(await screen.findByRole('link', { name: 'Review credentials' })).toBeVisible();
    await waitForMutationsIdle(client);
    expect(screen.queryByText(/^Runs on/)).not.toBeInTheDocument();
  });
});
