// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { useAgent } from '@mastra/react/hooks/agents';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectPromptTool } from '../connect-prompt-tool';
import {
  connectAgentBeforeLinear,
  connectAgentWithLinear,
  connectPromptPayload,
  connectPromptSession,
  connectPromptStatusActive,
} from './fixtures/connect-prompt';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import type { MessageMetadata } from '@/domains/chat/messages/message-metadata';
import { server } from '@/test/msw-server';

// The Nango frontend SDK opens real windows and websockets, so it is the one
// boundary mocked beyond MSW.
const nangoMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  close: vi.fn(),
  constructorOptions: [] as unknown[],
}));

vi.mock('@nangohq/frontend', async importOriginal => {
  const actual = await importOriginal<typeof import('@nangohq/frontend')>();
  class FakeNango {
    win = { close: nangoMocks.close };
    constructor(options: unknown) {
      nangoMocks.constructorOptions.push(options);
    }
    auth(...args: unknown[]) {
      return nangoMocks.auth(...args);
    }
  }
  return { ...actual, default: FakeNango };
});

const BASE_URL = 'http://localhost:4111';

/** The agent's tool list as the chat page's tools panel reads it. */
function AgentToolNames() {
  const { data } = useAgent({ agentId: connectAgentBeforeLinear.id });
  return (
    <ul aria-label="Agent tools">{data ? Object.keys(data.tools).map(name => <li key={name}>{name}</li>) : null}</ul>
  );
}

const toolCallId = 'call-request-connection';

/** Message metadata for a run paused on `request_connection` with this prompt. */
function suspendedOn(payload: unknown): MessageMetadata {
  return { suspendedTools: { [toolCallId]: { suspendPayload: payload, runId: 'run-1' } } };
}

/**
 * Renders the card the way ToolCard does. By default the run is paused on the
 * prompt (no output yet); pass `output` for a call that already finished.
 */
function renderConnectPrompt({
  output,
  metadata = output === undefined ? suspendedOn(connectPromptPayload) : undefined,
  readOnly,
  isRunning = false,
  toolCallApprovals = {},
  children,
}: {
  output?: unknown;
  metadata?: MessageMetadata;
  readOnly?: boolean;
  isRunning?: boolean;
  toolCallApprovals?: Record<string, { status: 'approved' | 'declined' }>;
  children?: React.ReactNode;
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const approveToolcall = vi.fn<(toolCallId: string, resumeData?: unknown) => void>();
  const tree = (running: boolean) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ToolCallProvider
          approveToolcall={approveToolcall}
          declineToolcall={vi.fn()}
          approveToolcallGenerate={vi.fn()}
          declineToolcallGenerate={vi.fn()}
          approveNetworkToolcall={vi.fn()}
          declineNetworkToolcall={vi.fn()}
          isRunning={running}
          toolCallApprovals={toolCallApprovals}
          networkToolCallApprovals={{}}
        >
          {children}
          <ConnectPromptTool
            toolName="request_connection"
            toolCallId={toolCallId}
            output={output}
            metadata={metadata}
            readOnly={readOnly}
          />
        </ToolCallProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
  const result = render(tree(isRunning));
  return { ...result, approveToolcall, setRunning: (running: boolean) => result.rerender(tree(running)) };
}

/** Serves a headless Linear flow whose status poll settles active. */
function linearConnectsHeadlessly() {
  server.use(
    http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
    http.get(launchPath, () =>
      HttpResponse.json({ sessionToken: 'nango_connect_session_t1', expiresAt: connectPromptSession.expiresAt }),
    ),
    http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
      HttpResponse.json(connectPromptStatusActive),
    ),
  );
}

const launchPath = `${BASE_URL}${connectPromptSession.launchUrl}`;

beforeEach(() => {
  nangoMocks.auth.mockReset();
  nangoMocks.auth.mockResolvedValue({});
  nangoMocks.close.mockReset();
  nangoMocks.constructorOptions.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConnectPromptTool', () => {
  describe('when the run is paused on a connect prompt', () => {
    it('renders each provider with its connection state', async () => {
      renderConnectPrompt();

      const card = await screen.findByRole('region', { name: 'Connect an account' });
      expect(card.textContent).toContain('Linear');
      expect(card.textContent).toContain('Notion');
      // Notion is already connected: no Connect action, just the state.
      expect(card.textContent).toContain('Connected');
      expect(screen.getAllByRole('button', { name: 'Connect' })).toHaveLength(1);
    });
  });

  describe('when the call finished with a connect-prompt result', () => {
    it('renders the providers from the result', async () => {
      renderConnectPrompt({ output: { ...connectPromptPayload, message: 'Linear connected successfully.' } });

      const card = await screen.findByRole('region', { name: 'Connect an account' });
      expect(card.textContent).toContain('Linear');
    });
  });

  describe('when neither the output nor the pause carries a connect-prompt payload', () => {
    it('renders nothing', () => {
      const { container } = renderConnectPrompt({ output: { anything: true } });
      expect(container.innerHTML).toBe('');
    });
  });

  describe('when rendering read-only history', () => {
    it('disables the connect action', async () => {
      renderConnectPrompt({ readOnly: true });
      const button = await screen.findByRole('button', { name: 'Connect' });
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('when the user connects an OAuth provider from the card', () => {
    it('authorizes headlessly with the gate-released token and marks the provider connected', async () => {
      const open = vi.spyOn(window, 'open');
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
        http.get(launchPath, () =>
          HttpResponse.json({ sessionToken: 'nango_connect_session_t1', expiresAt: connectPromptSession.expiresAt }),
        ),
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json(connectPromptStatusActive),
        ),
      );

      renderConnectPrompt();
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      // The poll settles active and the row flips to connected.
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull());
      const card = screen.getByRole('region', { name: 'Connect an account' });
      expect(card.textContent).toContain('Connected');

      // The SDK drove the provider's own consent popup, keyed by the token the
      // launch gate released — no window ever navigated to a hosted page.
      expect(nangoMocks.constructorOptions).toContainEqual({ connectSessionToken: 'nango_connect_session_t1' });
      expect(nangoMocks.auth).toHaveBeenCalledWith('linear', { detectClosedAuthWindow: true });
      expect(open).not.toHaveBeenCalled();
    });
  });

  describe('when the connection activates', () => {
    it('resumes the paused tool with the connected provider instead of sending a chat message', async () => {
      linearConnectsHeadlessly();

      const { approveToolcall } = renderConnectPrompt();
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      await waitFor(() =>
        expect(approveToolcall).toHaveBeenCalledWith(toolCallId, { provider: 'linear', status: 'active' }),
      );
      expect(approveToolcall).toHaveBeenCalledTimes(1);
    });

    it('refreshes the agent so its tool list shows the new provider tools', async () => {
      let linearActive = false;
      linearConnectsHeadlessly();
      server.use(
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () => {
          linearActive = true;
          return HttpResponse.json(connectPromptStatusActive);
        }),
        http.get(`${BASE_URL}/api/agents/${connectAgentBeforeLinear.id}`, () =>
          HttpResponse.json(linearActive ? connectAgentWithLinear : connectAgentBeforeLinear),
        ),
      );
      renderConnectPrompt({ children: <AgentToolNames /> });
      const tools = await screen.findByRole('list', { name: 'Agent tools' });
      await waitFor(() => expect(tools.textContent).toContain('request_connection'));
      expect(tools.textContent).not.toContain('linear_list_issues');

      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      await waitFor(() => expect(tools.textContent).toContain('linear_list_issues'));
    });

    it('does not let an agent request that started before the connection keep the old tool list', async () => {
      let linearActive = false;
      let releaseFirstAgentRequest!: () => void;
      const firstAgentRequestHeld = new Promise<void>(resolve => {
        releaseFirstAgentRequest = resolve;
      });
      let agentRequests = 0;
      linearConnectsHeadlessly();
      server.use(
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () => {
          linearActive = true;
          return HttpResponse.json(connectPromptStatusActive);
        }),
        http.get(`${BASE_URL}/api/agents/${connectAgentBeforeLinear.id}`, async () => {
          agentRequests += 1;
          const agent = linearActive ? connectAgentWithLinear : connectAgentBeforeLinear;
          // The first request reads the tools before the connection lands and answers after it.
          if (agentRequests === 1) await firstAgentRequestHeld;
          return HttpResponse.json(agent);
        }),
      );
      renderConnectPrompt({ children: <AgentToolNames /> });
      await waitFor(() => expect(agentRequests).toBe(1));

      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull());
      releaseFirstAgentRequest();

      const tools = await screen.findByRole('list', { name: 'Agent tools' });
      await waitFor(() => expect(tools.textContent).toContain('linear_list_issues'));
    });
  });

  describe('when the connection activates while the agent is still running', () => {
    it('waits for the run to stop before resuming', async () => {
      linearConnectsHeadlessly();

      const { approveToolcall, setRunning } = renderConnectPrompt({ isRunning: true });
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull());
      expect(approveToolcall).not.toHaveBeenCalled();

      setRunning(false);

      await waitFor(() =>
        expect(approveToolcall).toHaveBeenCalledWith(toolCallId, { provider: 'linear', status: 'active' }),
      );
    });
  });

  describe('when the paused call was already resumed', () => {
    it('does not resume it again', async () => {
      linearConnectsHeadlessly();

      const { approveToolcall } = renderConnectPrompt({ toolCallApprovals: { [toolCallId]: { status: 'approved' } } });
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull());

      expect(approveToolcall).not.toHaveBeenCalled();
    });
  });

  describe('when the call already finished and the user connects from its card', () => {
    it('has nothing to resume', async () => {
      linearConnectsHeadlessly();

      const { approveToolcall } = renderConnectPrompt({ output: connectPromptPayload });
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull());

      expect(approveToolcall).not.toHaveBeenCalled();
    });
  });

  describe('when a provider requires auth parameters that chat cannot collect', () => {
    it('uses the hosted flow instead of starting invalid headless authorization', async () => {
      const popup = { location: { href: '' }, close: vi.fn(), closed: false };
      const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' }),
        ),
      );
      const [provider] = connectPromptPayload.providers;
      if (!provider) throw new Error('Expected a connect prompt provider fixture');
      const output = {
        ...connectPromptPayload,
        providers: [
          {
            ...provider,
            authFields: [{ name: 'workspace', target: 'params' as const, label: 'Workspace', required: true }],
          },
        ],
      };

      renderConnectPrompt({ metadata: suspendedOn(output) });
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      await waitFor(() => expect(popup.location.href).toBe(launchPath));
      expect(open).toHaveBeenCalledWith('', 'mastra-connect', 'popup,width=600,height=720');
      expect(nangoMocks.auth).not.toHaveBeenCalled();
    });
  });

  describe('when authorization fails in the provider popup', () => {
    it('shows the failure reason and resumes the paused tool with it', async () => {
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
        http.get(launchPath, () =>
          HttpResponse.json({ sessionToken: 'nango_connect_session_t1', expiresAt: connectPromptSession.expiresAt }),
        ),
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' }),
        ),
      );
      const { AuthError } = await import('@nangohq/frontend');
      nangoMocks.auth.mockRejectedValueOnce(new AuthError('closed', 'window_closed'));

      const { approveToolcall } = renderConnectPrompt();
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toMatch(/window was closed/i);
      // The agent gets the same reason in the tool result instead of waiting forever.
      await waitFor(() =>
        expect(approveToolcall).toHaveBeenCalledWith(toolCallId, {
          provider: 'linear',
          status: 'failed',
          error: expect.stringMatching(/window was closed/i),
        }),
      );
      expect(approveToolcall).toHaveBeenCalledTimes(1);
      // The flow settled, so the action is available to retry.
      expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('when the connection settles in a non-active state', () => {
    it('resumes the paused tool with a failure the agent can relay', async () => {
      linearConnectsHeadlessly();
      server.use(
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json({ ...connectPromptStatusActive, status: 'failed' }),
        ),
      );

      const { approveToolcall } = renderConnectPrompt();
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      await waitFor(() =>
        expect(approveToolcall).toHaveBeenCalledWith(toolCallId, {
          provider: 'linear',
          status: 'failed',
          error: 'The connection was not completed.',
        }),
      );
    });
  });

  describe('when the connect session cannot be created', () => {
    it('resumes the paused tool with the platform reason', async () => {
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () =>
          HttpResponse.json(
            {
              error: {
                code: 'conflict',
                message: 'Connection limit reached for this resource on linear (max 5)',
              },
            },
            { status: 409 },
          ),
        ),
      );

      const { approveToolcall } = renderConnectPrompt();
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      expect((await screen.findByRole('alert')).textContent).toContain('Connection limit reached');
      await waitFor(() =>
        expect(approveToolcall).toHaveBeenCalledWith(toolCallId, {
          provider: 'linear',
          status: 'failed',
          error: 'Connection limit reached for this resource on linear (max 5)',
        }),
      );
      expect(approveToolcall).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the gate releases no token and the fallback popup is blocked', () => {
    it('offers a manual launch link to the launch gate', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null);
      server.use(
        http.post(`${BASE_URL}/connect/linear/sessions`, () => HttpResponse.json(connectPromptSession)),
        http.get(launchPath, () =>
          HttpResponse.json({ sessionToken: null, expiresAt: connectPromptSession.expiresAt }),
        ),
        http.get(`${BASE_URL}/connect/connections/${connectPromptSession.connectionId}/status`, () =>
          HttpResponse.json({ ...connectPromptStatusActive, status: 'pending' }),
        ),
      );

      renderConnectPrompt();
      fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

      const link = await screen.findByRole('link', { name: 'Open the connect window' });
      expect(link.getAttribute('href')).toBe(launchPath);
      expect(nangoMocks.auth).not.toHaveBeenCalled();
    });
  });
});
