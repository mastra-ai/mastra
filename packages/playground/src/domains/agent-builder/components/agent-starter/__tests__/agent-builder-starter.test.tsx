import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { usePlaygroundStore } from '@mastra/playground-ui/store/playground-store';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA } from '../../../constants/default-request-context-schema';
import { AgentBuilderStarter } from '../agent-builder-starter';
import { server } from '@/test/msw-server';

const navigateMock = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});
vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BASE_URL = 'http://localhost:4111';

const renderStarter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter>
            <AgentBuilderStarter />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

describe('AgentBuilderStarter', () => {
  beforeEach(() => {
    usePlaygroundStore.setState({ requestContext: {} });
    // The starter pulls builder settings + provider models so it can pick a
    // model that the admin policy allows. Stub the bare minimum: no policy and
    // an empty provider list, which yields the hard-coded fallback model.
    server.use(
      http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
        HttpResponse.json({ enabled: true, modelPolicy: { active: false } }),
      ),
      http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
      http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: true, login: null })),
    );
  });

  afterEach(() => {
    cleanup();
    navigateMock.mockReset();
  });

  it('renders a submit button that is disabled until the input has content', async () => {
    const { getByTestId } = renderStarter();
    const submit = getByTestId('agent-builder-starter-submit') as HTMLButtonElement;
    const input = getByTestId('agent-builder-starter-input') as HTMLTextAreaElement;

    expect(submit.type).toBe('submit');
    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'build something' } });
    await waitFor(() => expect(submit.disabled).toBe(false));
  });

  it('does not render a "create manually" affordance — users must use the prompt input', () => {
    const { queryByTestId } = renderStarter();
    expect(queryByTestId('agent-builder-starter-create-manually')).toBeNull();
  });

  it('eagerly creates the agent then navigates to its edit page with the user message', async () => {
    let capturedBody: any = null;
    server.use(
      http.post(`${BASE_URL}/api/stored/agents`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: capturedBody.id });
      }),
    );

    const { getByTestId } = renderStarter();
    const input = getByTestId('agent-builder-starter-input') as HTMLTextAreaElement;
    const submit = getByTestId('agent-builder-starter-submit') as HTMLButtonElement;

    fireEvent.change(input, { target: { value: 'build a tutor agent' } });
    // Wait for builder settings to load so submit is no longer gated.
    await waitFor(() => expect(submit.disabled).toBe(false));

    await act(async () => {
      fireEvent.click(submit);
    });

    // The MSW handler populates `capturedBody` asynchronously, so wait for the
    // POST to land before reading its fields. Avoids a race that previously
    // made this assertion flaky on slow runners.
    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody.name).toBe('build a tutor agent');
    expect(capturedBody.instructions).toBe('');
    expect(capturedBody.model).toEqual({ provider: 'google', name: 'gemini-2.5-flash' });
    expect(capturedBody.visibility).toBe('private');
    expect(capturedBody.requestContextSchema).toEqual(DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
    const [path, opts] = navigateMock.mock.calls[0];
    expect(path).toBe(`/agent-builder/agents/${capturedBody.id}/edit`);
    expect(opts).toMatchObject({
      state: { userMessage: 'build a tutor agent' },
      viewTransition: true,
    });
  });

  it('omits the request-context schema when auth is disabled', async () => {
    server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })));

    let capturedBody: any = null;
    server.use(
      http.post(`${BASE_URL}/api/stored/agents`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: capturedBody.id });
      }),
    );

    const { getByTestId } = renderStarter();
    const input = getByTestId('agent-builder-starter-input') as HTMLTextAreaElement;
    const submit = getByTestId('agent-builder-starter-submit') as HTMLButtonElement;

    fireEvent.change(input, { target: { value: 'build a tutor agent' } });
    await waitFor(() => expect(submit.disabled).toBe(false));

    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody.requestContextSchema).toBeUndefined();
  });

  it('truncates long prompts to 20 chars + ellipsis when generating the temp name', async () => {
    let capturedBody: any = null;
    server.use(
      http.post(`${BASE_URL}/api/stored/agents`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: capturedBody.id });
      }),
    );

    const longPrompt = 'build a really helpful pull request reviewer agent for typescript repos';
    const { getByTestId } = renderStarter();
    fireEvent.change(getByTestId('agent-builder-starter-input'), { target: { value: longPrompt } });
    await waitFor(() =>
      expect((getByTestId('agent-builder-starter-submit') as HTMLButtonElement).disabled).toBe(false),
    );

    await act(async () => {
      fireEvent.click(getByTestId('agent-builder-starter-submit'));
    });

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody.name).toBe(longPrompt.slice(0, 20) + '\u2026');
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });

  it('disables the input and shows a spinner while the create request is in flight, then navigates once it resolves', async () => {
    let resolveResponse: () => void = () => {};
    const pending = new Promise<void>(resolve => {
      resolveResponse = resolve;
    });
    let capturedId: string | undefined;

    server.use(
      http.post(`${BASE_URL}/api/stored/agents`, async ({ request }) => {
        const body = (await request.json()) as { id: string };
        capturedId = body.id;
        await pending;
        return HttpResponse.json({ id: body.id });
      }),
    );

    const { getByTestId, queryByTestId } = renderStarter();
    const input = getByTestId('agent-builder-starter-input') as HTMLTextAreaElement;
    const submit = getByTestId('agent-builder-starter-submit') as HTMLButtonElement;

    fireEvent.change(input, { target: { value: 'standup bot' } });
    // Wait for builder settings to load so submit is no longer gated by it,
    // otherwise the click below is a no-op and the spinner never appears.
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.click(submit);

    await waitFor(() => expect(submit.disabled).toBe(true));
    expect(input.disabled).toBe(true);
    expect(queryByTestId('agent-builder-starter-submit-spinner')).not.toBeNull();
    expect(navigateMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveResponse();
    });

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
    const [path] = navigateMock.mock.calls[0];
    expect(path).toBe(`/agent-builder/agents/${capturedId}/edit`);
  });

  it('prefers the admin-configured modelPolicy default over the first allowed model (PLTFRM-1017)', async () => {
    // When the admin configures a default model on an active policy, the
    // starter must commit to that default — not the first allowlist entry
    // (which is what we used to pick, and which broke the configured default).
    // Model IDs use placeholder tokens documented in
    // docs/src/plugins/remark-model-tokens/models.ts.
    const ALLOWED_MODEL_PROVIDER = 'anthropic';
    const ALLOWED_MODEL_ID = 'claude-opus-4-7'; // __GATEWAY_ANTHROPIC_MODEL_OPUS__
    const DEFAULT_MODEL_PROVIDER = 'openai';
    const DEFAULT_MODEL_ID = 'gpt-5.4'; // __GATEWAY_OPENAI_MODEL__

    let capturedBody: any = null;
    server.use(
      http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
        HttpResponse.json({
          enabled: true,
          modelPolicy: {
            active: true,
            pickerVisible: true,
            allowed: [
              { provider: ALLOWED_MODEL_PROVIDER, modelId: ALLOWED_MODEL_ID },
              { provider: DEFAULT_MODEL_PROVIDER },
            ],
            default: { provider: DEFAULT_MODEL_PROVIDER, modelId: DEFAULT_MODEL_ID },
          },
        }),
      ),
      http.post(`${BASE_URL}/api/stored/agents`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: capturedBody.id });
      }),
    );

    const { getByTestId } = renderStarter();

    // The submit button is gated on `useBuilderSettings().isLoading`, so once
    // it's enabled we know React Query has the policy cached and the next
    // submit will see the active policy. This replaces the prior flaky
    // `setTimeout(0)` workaround with a deterministic UI signal.
    fireEvent.change(getByTestId('agent-builder-starter-input'), { target: { value: 'standup bot' } });
    await waitFor(() =>
      expect((getByTestId('agent-builder-starter-submit') as HTMLButtonElement).disabled).toBe(false),
    );

    await act(async () => {
      fireEvent.click(getByTestId('agent-builder-starter-submit'));
    });

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody.model).toEqual({ provider: DEFAULT_MODEL_PROVIDER, name: DEFAULT_MODEL_ID });
  });

  it('does not navigate when the create request fails', async () => {
    server.use(
      http.post(`${BASE_URL}/api/stored/agents`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })),
    );

    const { getByTestId } = renderStarter();
    fireEvent.change(getByTestId('agent-builder-starter-input'), { target: { value: 'support triage' } });
    const submit = getByTestId('agent-builder-starter-submit') as HTMLButtonElement;
    await waitFor(() => expect(submit.disabled).toBe(false));

    await act(async () => {
      fireEvent.click(submit);
    });

    expect(navigateMock).not.toHaveBeenCalled();
    await waitFor(() => expect(submit.disabled).toBe(false));
  });
});
