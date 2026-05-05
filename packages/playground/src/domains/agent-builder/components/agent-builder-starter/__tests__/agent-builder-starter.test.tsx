// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw-server';

const navigateMock = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    usePlaygroundStore: () => ({ requestContext: undefined }),
  };
});

vi.mock('@/domains/auth/hooks/use-default-visibility', () => ({
  useDefaultVisibility: () => 'private',
}));

import { AgentBuilderStarter } from '../agent-builder-starter';

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
    // The starter pulls builder settings + provider models so it can pick a
    // model that the admin policy allows. Stub the bare minimum: no policy and
    // an empty provider list, which yields the hard-coded fallback model.
    server.use(
      http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
        HttpResponse.json({ enabled: true, modelPolicy: { active: false } }),
      ),
      http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
    );
  });

  afterEach(() => {
    cleanup();
    navigateMock.mockReset();
  });

  it('renders a submit button that is disabled until the input has content', () => {
    const { getByTestId } = renderStarter();
    const submit = getByTestId('agent-builder-starter-submit') as HTMLButtonElement;
    const input = getByTestId('agent-builder-starter-input') as HTMLTextAreaElement;

    expect(submit.type).toBe('submit');
    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'build something' } });
    expect(submit.disabled).toBe(false);
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
    const submit = getByTestId('agent-builder-starter-submit');

    fireEvent.change(input, { target: { value: 'build a tutor agent' } });

    await act(async () => {
      fireEvent.click(submit);
    });

    expect(capturedBody).toBeTruthy();
    expect(capturedBody.name).toBe('build a tutor agent');
    expect(capturedBody.instructions).toBe('');
    expect(capturedBody.model).toEqual({ provider: 'google', name: 'gemini-2.5-flash' });
    expect(capturedBody.visibility).toBe('private');

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
    const [path, opts] = navigateMock.mock.calls[0];
    expect(path).toBe(`/agent-builder/agents/${capturedBody.id}/edit`);
    expect(opts).toMatchObject({
      state: { userMessage: 'build a tutor agent' },
      viewTransition: true,
    });
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

    await act(async () => {
      fireEvent.click(getByTestId('agent-builder-starter-submit'));
    });

    expect(capturedBody.name).toBe(longPrompt.slice(0, 20) + '…');
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

  it('does not navigate when the create request fails', async () => {
    server.use(
      http.post(`${BASE_URL}/api/stored/agents`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    const { getByTestId } = renderStarter();
    fireEvent.change(getByTestId('agent-builder-starter-input'), { target: { value: 'support triage' } });

    await act(async () => {
      fireEvent.click(getByTestId('agent-builder-starter-submit'));
    });

    expect(navigateMock).not.toHaveBeenCalled();
    const submit = getByTestId('agent-builder-starter-submit') as HTMLButtonElement;
    await waitFor(() => expect(submit.disabled).toBe(false));
  });
});
