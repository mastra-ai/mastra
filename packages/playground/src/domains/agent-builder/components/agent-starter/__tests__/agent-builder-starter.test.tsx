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
import { AgentBuilderStarter } from '../agent-builder-starter';
import { AgentCreationInProgress } from '../agent-creation-in-progress';
import { CREATION_STEPS } from '../creation-steps';
import {
  encodeChunks,
  failedCreationChunks,
  runningCreationChunks,
  successfulCreationChunks,
} from './fixtures/creation-workflow';
import { server } from '@/test/msw-server';

const navigateMock = vi.fn();
const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));

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
    toast: { success: vi.fn(), error: toastErrorMock },
  };
});

const BASE_URL = 'http://localhost:4111';
const WORKFLOW_ID = 'agent-builder-creation';
const CREATED_AGENT_ID = 'agent-created-123';
const CURRENT_USER = { id: 'user-1', name: 'Ada', email: 'ada@example.com' };

const renderStarter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(
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
  return { ...utils, queryClient };
};

/**
 * Wait for the `useCurrentUser` query to settle so the starter has resolved the
 * authenticated user before it submits and builds the request context.
 */
const waitForAuthSettled = async (queryClient: QueryClient) => {
  await waitFor(() => {
    const state = queryClient.getQueryState(['auth', 'me']);
    expect(state?.status === 'success' || state?.status === 'error').toBe(true);
  });
};

/**
 * Wire the create-run + stream endpoints the creation workflow drives. The
 * stream body is RECORD_SEPARATOR-delimited JSON the client SDK parses into
 * `StreamVNextChunkType` chunks.
 */
const useCreationHandlers = (opts?: {
  onCreateRun?: () => void;
  onStream?: (body: unknown) => void;
  streamBody?: string;
  createRunStatus?: number;
}) => {
  server.use(
    http.post(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/create-run`, () => {
      opts?.onCreateRun?.();
      if (opts?.createRunStatus && opts.createRunStatus >= 400) {
        return HttpResponse.json({ message: 'nope' }, { status: opts.createRunStatus });
      }
      return HttpResponse.json({ runId: 'run-creation-1' });
    }),
    http.post(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/stream`, async ({ request }) => {
      opts?.onStream?.(await request.json());
      return new HttpResponse(opts?.streamBody ?? encodeChunks(successfulCreationChunks(CREATED_AGENT_ID)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
};

const withCurrentUser = () => {
  server.use(http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(CURRENT_USER)));
};

const withoutCurrentUser = () => {
  server.use(
    http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(null, { status: 401 })),
    // `fetchWithRefresh` attempts a session refresh on a 401; keep it handled so
    // MSW's `onUnhandledRequest: 'error'` does not flag it.
    http.post(`${BASE_URL}/api/auth/refresh`, () => HttpResponse.json(null, { status: 401 })),
  );
};

const enableSubmit = async (getByTestId: (id: string) => HTMLElement, prompt: string) => {
  const input = getByTestId('agent-builder-starter-input') as HTMLTextAreaElement;
  const submit = getByTestId('agent-builder-starter-submit') as HTMLButtonElement;
  fireEvent.change(input, { target: { value: prompt } });
  await waitFor(() => expect(submit.disabled).toBe(false));
  return { input, submit };
};

describe('AgentBuilderStarter', () => {
  beforeEach(() => {
    withCurrentUser();
  });

  afterEach(() => {
    cleanup();
    navigateMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('keeps the submit button disabled until the prompt has content', async () => {
    useCreationHandlers();
    const { getByTestId } = renderStarter();
    const submit = getByTestId('agent-builder-starter-submit') as HTMLButtonElement;
    const input = getByTestId('agent-builder-starter-input') as HTMLTextAreaElement;

    expect(submit.type).toBe('submit');
    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'build a tutor agent' } });
    await waitFor(() => expect(submit.disabled).toBe(false));

    // Whitespace-only input does not count as content.
    fireEvent.change(input, { target: { value: '   ' } });
    await waitFor(() => expect(submit.disabled).toBe(true));
  });

  it('runs the creation workflow with the prompt and does not call the legacy stored-agents create endpoint', async () => {
    const onCreateRun = vi.fn();
    let streamBody: any = null;
    const onStoredAgents = vi.fn();
    useCreationHandlers({ onCreateRun, onStream: body => (streamBody = body) });
    server.use(
      http.post(`${BASE_URL}/api/stored/agents`, () => {
        onStoredAgents();
        return HttpResponse.json({ id: 'should-not-happen' });
      }),
    );

    const { getByTestId } = renderStarter();
    const { submit } = await enableSubmit(getByTestId, 'build a tutor agent');

    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => expect(onCreateRun).toHaveBeenCalled());
    await waitFor(() => expect(streamBody).not.toBeNull());
    expect(streamBody.inputData).toEqual({ prompt: 'build a tutor agent' });
    expect(onStoredAgents).not.toHaveBeenCalled();
  });

  it('forwards the current user as the request-context author when streaming', async () => {
    let streamBody: any = null;
    useCreationHandlers({ onStream: body => (streamBody = body) });

    const { getByTestId, queryClient } = renderStarter();
    await waitForAuthSettled(queryClient);
    const { submit } = await enableSubmit(getByTestId, 'support triage');

    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => expect(streamBody).not.toBeNull());
    expect(streamBody.requestContext).toMatchObject({ user: CURRENT_USER });
  });

  it('omits the user request-context key when there is no authenticated user', async () => {
    withoutCurrentUser();
    let streamBody: any = null;
    useCreationHandlers({ onStream: body => (streamBody = body) });

    const { getByTestId, queryClient } = renderStarter();
    await waitForAuthSettled(queryClient);
    const { submit } = await enableSubmit(getByTestId, 'support triage');

    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => expect(streamBody).not.toBeNull());
    expect(streamBody.requestContext?.user).toBeUndefined();
  });

  it('keeps the composer (not the timeline) up after submit until the workflow actually streams', async () => {
    let releaseStream: () => void = () => {};
    const streamGate = new Promise<void>(resolve => {
      releaseStream = resolve;
    });
    server.use(
      http.post(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/create-run`, () =>
        HttpResponse.json({ runId: 'run-creation-1' }),
      ),
      http.post(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/stream`, async () => {
        // Hold the stream so it never emits `workflow-start`: the run is in
        // flight but not yet streaming, so the timeline must not be shown.
        await streamGate;
        return new HttpResponse(encodeChunks(runningCreationChunks()), {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const { getByTestId, queryByTestId } = renderStarter();
    const { submit, input } = await enableSubmit(getByTestId, 'standup bot');
    fireEvent.click(submit);

    // Before any chunk arrives the composer stays mounted (disabled, with its
    // submit spinner) — the timeline only appears once the stream is running.
    await waitFor(() => expect(submit.disabled).toBe(true));
    expect(input).not.toBeNull();
    expect(queryByTestId('agent-creation-in-progress')).toBeNull();

    await act(async () => {
      releaseStream();
    });

    // Once the stream starts (a non-terminal body that stays `running`) the
    // timeline replaces the prompt form.
    await waitFor(() => expect(queryByTestId('agent-creation-in-progress')).not.toBeNull());
    expect(queryByTestId('agent-builder-starter-input')).toBeNull();
    expect(queryByTestId('agent-builder-starter-submit')).toBeNull();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('renders the centered step timeline with every workflow step while the workflow streams', async () => {
    server.use(
      http.post(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/create-run`, () =>
        HttpResponse.json({ runId: 'run-creation-1' }),
      ),
      // A non-terminal stream (no `workflow-finish`) keeps the run in the
      // `running` state, so the timeline stays mounted for assertions.
      http.post(
        `${BASE_URL}/api/workflows/${WORKFLOW_ID}/stream`,
        () =>
          new HttpResponse(encodeChunks(runningCreationChunks()), {
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const { getByTestId, queryByTestId } = renderStarter();
    const { submit } = await enableSubmit(getByTestId, 'standup bot');
    fireEvent.click(submit);

    // The prompt form is replaced by the dedicated running-state timeline, which
    // lists every workflow step up front.
    await waitFor(() => expect(queryByTestId('agent-creation-in-progress')).not.toBeNull());
    expect(queryByTestId('agent-builder-starter-input')).toBeNull();
    for (const step of CREATION_STEPS) {
      expect(getByTestId(`creation-step-${step.id}`)).not.toBeNull();
    }
    // The live chunks drive per-step status: the first step finished, the next
    // is running, and steps absent from the stream stay not-started.
    await waitFor(() =>
      expect(getByTestId('creation-step-understand-user-outcome').getAttribute('data-status')).toBe('success'),
    );
    expect(getByTestId('creation-step-feature-capability').getAttribute('data-status')).toBe('running');
    expect(getByTestId('creation-step-persist-agent').getAttribute('data-status')).toBe('pending');
  });

  it('maps live per-step status to success, running and not-started states', () => {
    // The timeline derives each row's state from `streamResult.steps`. Render it
    // directly with a representative mid-run snapshot: an earlier step done, the
    // current step running, and the remaining steps absent (not started).
    const steps = {
      'understand-user-outcome': { status: 'success' },
      'feature-capability': { status: 'running' },
    };

    const { getByTestId } = render(<AgentCreationInProgress steps={steps} />);

    expect(getByTestId('agent-creation-in-progress')).not.toBeNull();
    expect(getByTestId('creation-step-understand-user-outcome').getAttribute('data-status')).toBe('success');
    expect(getByTestId('creation-step-feature-capability').getAttribute('data-status')).toBe('running');
    // A step absent from the stream record is treated as not started.
    expect(getByTestId('creation-step-persist-agent').getAttribute('data-status')).toBe('pending');
    // Every step in the manifest is listed up front.
    for (const step of CREATION_STEPS) {
      expect(getByTestId(`creation-step-${step.id}`)).not.toBeNull();
    }
  });

  it('shows a secondary detail line summarizing each step value from its output', () => {
    // Each step's `output` is the accumulated config; the timeline derives a
    // dimmer secondary line summarizing the value that step resolved.
    const steps = {
      'understand-user-outcome': { status: 'success', output: { userOutcome: { goal: 'Tutor students' } } },
      'set-agent-name': { status: 'success', output: { name: 'Tutor' } },
      'set-agent-model': { status: 'success', output: { model: { provider: 'openai', name: 'gpt-4o' } } },
      'set-agent-tools': {
        status: 'success',
        output: { tools: { search: true, calc: false }, agents: { helper: true } },
      },
      'set-agent-browser-enabled': { status: 'success', output: { browserEnabled: true } },
      // No meaningful value resolved yet → no detail line is rendered.
      'set-agent-skills': { status: 'success', output: { skills: {} } },
    };

    const { getByTestId, queryByTestId } = render(<AgentCreationInProgress steps={steps} />);

    expect(getByTestId('creation-step-understand-user-outcome-detail').textContent).toBe('Tutor students');
    expect(getByTestId('creation-step-set-agent-name-detail').textContent).toBe('Tutor');
    expect(getByTestId('creation-step-set-agent-model-detail').textContent).toBe('openai/gpt-4o');
    // Only enabled (true) entries are listed, across tools + agents + workflows.
    expect(getByTestId('creation-step-set-agent-tools-detail').textContent).toBe('search, helper');
    expect(getByTestId('creation-step-set-agent-browser-enabled-detail').textContent).toBe('Browser access enabled');
    // A step with no enabled entries renders no detail line.
    expect(queryByTestId('creation-step-set-agent-skills-detail')).toBeNull();
    // A not-started step has no detail line either.
    expect(queryByTestId('creation-step-persist-agent-detail')).toBeNull();
  });

  it('renders View agent and Review config CTAs on completion and navigates to the right routes', async () => {
    useCreationHandlers();

    const { getByTestId } = renderStarter();
    const { submit } = await enableSubmit(getByTestId, 'build a tutor agent');

    await act(async () => {
      fireEvent.click(submit);
    });

    const complete = await waitFor(() => getByTestId('agent-builder-starter-complete'));
    // The completion view welcomes the user to their named agent and surfaces the
    // resolved description, both read from the persisted config result.
    expect(complete.textContent).toContain('Welcome to Tutor');
    expect(getByTestId('agent-builder-starter-complete-description').textContent).toBe('A tutor');

    fireEvent.click(getByTestId('agent-builder-starter-view'));
    expect(navigateMock).toHaveBeenLastCalledWith(`/agent-builder/agents/${CREATED_AGENT_ID}/view`, {
      viewTransition: true,
    });

    fireEvent.click(getByTestId('agent-builder-starter-review'));
    expect(navigateMock).toHaveBeenLastCalledWith(`/agent-builder/agents/${CREATED_AGENT_ID}/onboarding`, {
      viewTransition: true,
    });
  });

  it('surfaces an error toast and re-enables submit when the run fails', async () => {
    useCreationHandlers({ createRunStatus: 500 });

    const { getByTestId } = renderStarter();
    const { submit } = await enableSubmit(getByTestId, 'support triage');

    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalled();
    await waitFor(() => expect(submit.disabled).toBe(false));
  });

  it('reports the failed workflow status through the stream error handler', async () => {
    useCreationHandlers({ streamBody: encodeChunks(failedCreationChunks()) });

    const { getByTestId, queryByTestId } = renderStarter();
    const { submit } = await enableSubmit(getByTestId, 'support triage');

    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(queryByTestId('agent-builder-starter-complete')).toBeNull();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
