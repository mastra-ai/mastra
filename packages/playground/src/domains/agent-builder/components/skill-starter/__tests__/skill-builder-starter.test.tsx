import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { usePlaygroundStore } from '@mastra/playground-ui/store/playground-store';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillBuilderStarter } from '../skill-builder-starter';
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
            <SkillBuilderStarter />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

describe('SkillBuilderStarter', () => {
  beforeEach(() => {
    usePlaygroundStore.setState({ requestContext: {} });
    // The starter pulls builder settings + stored workspaces so it can choose a
    // default workspace. Stub both: builder enabled with no agent-workspace
    // pin, and an empty workspace list so workspaceId stays undefined.
    server.use(
      http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
        HttpResponse.json({ enabled: true, modelPolicy: { active: false } }),
      ),
      http.get(`${BASE_URL}/api/stored/workspaces`, () => HttpResponse.json({ workspaces: [] })),
      // useDefaultVisibility resolves to 'private' when auth is enabled.
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: true, login: null })),
    );
  });

  afterEach(() => {
    cleanup();
    navigateMock.mockReset();
  });

  it('renders a submit button that is disabled until the input has content', () => {
    const { getByTestId } = renderStarter();
    const submit = getByTestId('skill-builder-starter-submit') as HTMLButtonElement;
    const input = getByTestId('skill-builder-starter-input') as HTMLTextAreaElement;

    expect(submit.type).toBe('submit');
    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'build something useful' } });
    expect(submit.disabled).toBe(false);
  });

  it('creates the skill with a client-side id and navigates to /agent-builder/skills/:id/edit with the prompt as userMessage', async () => {
    let capturedBody: any = null;
    let capabilitiesLoaded = false;
    server.use(
      http.get(`${BASE_URL}/api/auth/capabilities`, () => {
        capabilitiesLoaded = true;
        return HttpResponse.json({ enabled: true, login: null });
      }),
      http.post(`${BASE_URL}/api/stored/skills`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: capturedBody.id });
      }),
    );

    const { getByTestId } = renderStarter();
    const input = getByTestId('skill-builder-starter-input') as HTMLTextAreaElement;
    const submit = getByTestId('skill-builder-starter-submit');

    fireEvent.change(input, { target: { value: 'code reviewer' } });
    // Default visibility ('private') depends on auth capabilities resolving.
    await waitFor(() => expect(capabilitiesLoaded).toBe(true));

    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => expect(capturedBody).toBeTruthy());
    expect(typeof capturedBody.id).toBe('string');
    expect(capturedBody.id.length).toBeGreaterThan(0);
    expect(capturedBody.name).toBe('code reviewer');
    expect(capturedBody.description).toBe('');
    expect(capturedBody.instructions).toBe('');
    expect(capturedBody.visibility).toBe('private');

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
    const [path, opts] = navigateMock.mock.calls[0];
    expect(path).toBe(`/agent-builder/skills/${capturedBody.id}/edit`);
    expect(opts).toMatchObject({
      state: { userMessage: 'code reviewer' },
      viewTransition: true,
    });
  });

  it('truncates long prompts to 20 chars + ellipsis for the placeholder name', async () => {
    let capturedBody: any = null;
    server.use(
      http.post(`${BASE_URL}/api/stored/skills`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: capturedBody.id });
      }),
    );

    const longPrompt = 'build a skill that helps engineers review pull requests for typescript repos';
    const { getByTestId } = renderStarter();
    fireEvent.change(getByTestId('skill-builder-starter-input'), { target: { value: longPrompt } });

    await act(async () => {
      fireEvent.click(getByTestId('skill-builder-starter-submit'));
    });

    await waitFor(() => expect(capturedBody).toBeTruthy());
    expect(capturedBody.name).toBe(longPrompt.slice(0, 20) + '…');
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });
});
