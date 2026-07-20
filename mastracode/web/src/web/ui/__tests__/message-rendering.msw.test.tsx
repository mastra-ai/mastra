import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { loginUrl, logoutUrl } from '../domains/auth';
import Chat from '../domains/chat/Chat';
import { NewPage } from '../domains/chat/NewPage';
import { ThreadPage } from '../domains/chat/ThreadPage';
import type { Factory } from '../domains/workspaces';

/**
 * Renders <Chat /> inside a memory router mirroring the app's pathless chat
 * layout (Chat itself uses router hooks for /threads/:threadId navigation).
 * Auth guards are intentionally bypassed — these specs stub /auth/me directly.
 */
function renderChat() {
  const router = createMemoryRouter(
    [
      {
        element: <Chat />,
        children: [
          { path: '/chat', element: <NewPage /> },
          { path: '/threads/:threadId', element: <ThreadPage /> },
        ],
      },
    ],
    // The transcript only renders on the thread's own page now — /chat is the
    // draft composer and hides the bound thread's history.
    { initialEntries: ['/threads/thread-test'] },
  );
  return renderWithProviders(<RouterProvider router={router} />);
}

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';
const PROJECT_PATH = '/tmp/mastracode-test';

function dbMessage(id: string, role: MastraDBMessage['role'], parts: MastraMessagePart[]): MastraDBMessage {
  return { id, role, createdAt: new Date(), content: { format: 2, parts } };
}

describe('web UI stylesheet entry', () => {
  it('imports the shared Playground UI stylesheet instead of the removed local stylesheet', () => {
    const mainSource = readFileSync(join(process.cwd(), 'src/web/ui/main.tsx'), 'utf8');

    expect(mainSource).toContain("import '@mastra/playground-ui/style.css';");
    expect(mainSource).not.toContain("import './styles.css';");
  });
});

function seedFactory() {
  const project: Factory = {
    id: 'project-test',
    name: 'MastraCode Test',
    resourceId: RESOURCE_ID,
    createdAt: 1,
    binding: {
      kind: 'local',
      path: PROJECT_PATH,
    },
  };
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-factory', project.id);
}

function sessionState(): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function sse(events: AgentControllerEvent[] = []): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      },
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function delayedSse(event: AgentControllerEvent) {
  const encoder = new TextEncoder();
  const emitters = new Set<() => void>();
  let pending = false;
  let markReady: () => void = () => {};
  const ready = new Promise<void>(resolve => {
    markReady = resolve;
  });
  const response = () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          const emit = () => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          emitters.add(emit);
          if (pending) emit();
          markReady();
        },
        cancel() {},
      }),
      { headers: { 'content-type': 'text/event-stream' } },
    );
  return {
    response,
    emit: () =>
      ready.then(() => {
        pending = true;
        emitters.forEach(emit => emit());
      }),
  };
}

function useAgentControllerHandlers({
  messages = [],
  events = [],
}: {
  messages?: MastraDBMessage[];
  events?: AgentControllerEvent[];
} = {}) {
  const onState = vi.fn();
  const onMode = vi.fn();
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(`${TEST_BASE_URL}/auth/me`, () => new Response(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, installations: [] }),
    ),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, async ({ request }) => {
      onState(await request.json());
      return HttpResponse.json(sessionState());
    }),
    http.post(`${SESSION}/mode`, async ({ request }) => {
      onMode(await request.json());
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () =>
      HttpResponse.json({
        threads: [
          {
            id: THREAD_ID,
            title: 'Thread test',
            resourceId: RESOURCE_ID,
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      }),
    ),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages })),
    http.get(`${SESSION}/stream`, () => sse(events)),
  );
  return { onState, onMode };
}

function useAuthMe(state: { authenticated?: boolean; user?: { name?: string; email?: string } | null } | null = null) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      state ? HttpResponse.json(state) : HttpResponse.json({}, { status: 404 }),
    ),
  );
}

function renderSeededApp(
  authState: { authenticated?: boolean; user?: { name?: string; email?: string } | null } | null = null,
) {
  seedFactory();
  useAgentControllerHandlers();
  if (authState) window.__MASTRACODE_CONFIG__ = { authEnabled: true };
  useAuthMe(authState);
  return renderChat();
}

/** Locate a migrated tool card by its accessible group label ("Tool: <name>"). */
async function findToolCard(toolName: string): Promise<HTMLElement> {
  return screen.findByRole('group', { name: `Tool: ${toolName}` });
}

afterEach(() => {
  localStorage.clear();
  delete window.__MASTRACODE_CONFIG__;
});

describe('MastraCode sidebar auth actions', () => {
  it('given web auth is disabled, when the app renders, then no auth action appears', async () => {
    renderSeededApp();

    await waitFor(() => expect(screen.queryByRole('status', { name: 'Checking sign-in' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('given web auth is enabled and unauthenticated, when the app renders, then the sidebar shows no sign-in action', async () => {
    renderSeededApp({ authenticated: false, user: null });

    await waitFor(() => expect(screen.queryByRole('status', { name: 'Checking sign-in' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('given web auth is enabled and authenticated, when the app renders, then the sidebar shows identity and Sign out', async () => {
    renderSeededApp({ authenticated: true, user: { name: 'Ada Lovelace', email: 'ada@example.com' } });

    await waitFor(() => expect(screen.queryByRole('status', { name: 'Checking sign-in' })).not.toBeInTheDocument());
    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('given an unauthenticated user, when the login URL is generated, then it preserves the current route', () => {
    window.history.replaceState(null, '', '/projects?thread=abc');

    expect(loginUrl(TEST_BASE_URL)).toBe(`${TEST_BASE_URL}/auth/login?returnTo=%2Fprojects%3Fthread%3Dabc`);
  });

  it('given an explicit returnTo, when the login URL is generated, then it targets that destination', () => {
    expect(loginUrl(TEST_BASE_URL, '/chat')).toBe(`${TEST_BASE_URL}/auth/login?returnTo=%2Fchat`);
  });

  it('given a same-origin deployment, when the login URL is generated with an empty base, then it stays relative', () => {
    expect(loginUrl('', '/chat')).toBe('/auth/login?returnTo=%2Fchat');
  });

  it('given an authenticated user, when the logout URL is generated, then it targets the logout route', () => {
    expect(logoutUrl(TEST_BASE_URL)).toBe(`${TEST_BASE_URL}/auth/logout`);
  });
});

describe('MastraCode empty thread state', () => {
  it('given a project with no messages, when the app renders, then the Mastra Code wordmark hero appears', async () => {
    renderSeededApp();

    await waitFor(() => {
      expect(screen.getByText('Ready for new conversation')).toBeInTheDocument();
      const wordmark = screen.getByLabelText('Mastra Code');
      expect(wordmark).toBeInTheDocument();
      // The hero sits inside the transcript scroller, which centers empty content vertically.
      expect(wordmark.closest('.place-items-center')).not.toBeNull();
    });
  });
});

describe('MastraCode message rendering', () => {
  it('renders hydrated persisted text, thinking, and tool content through Mastra message parts', async () => {
    seedFactory();
    useAgentControllerHandlers({
      messages: [
        dbMessage('assistant-1', 'assistant', [
          { type: 'text', text: '**Hello** from hydrate' },
          { type: 'reasoning', reasoning: 'checking files', details: [{ type: 'text', text: 'checking files' }] },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-1',
              toolName: 'view',
              args: { path: 'README.md' },
              result: 'readme contents',
            },
          },
        ]),
      ],
    });

    renderChat();

    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading messages' })).not.toBeInTheDocument());
    await waitFor(() => {
      expect(document.body).toHaveTextContent('Hello from hydrate');
      expect(document.body).toHaveTextContent('from hydrate');
      expect(screen.getByText('checking files')).toBeInTheDocument();
      const card = screen.getByRole('group', { name: 'Tool: view' });
      // Successful tools render no status badge; only running/failed states are labeled.
      expect(within(card).queryByText('Done')).not.toBeInTheDocument();
      expect(within(card).queryByText('Running')).not.toBeInTheDocument();
      expect(within(card).queryByText('Failed')).not.toBeInTheDocument();
    });
  });

  it('composes consecutive tool cards into a single bordered container', async () => {
    seedFactory();
    useAgentControllerHandlers({
      messages: [
        dbMessage('assistant-tools', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-a',
              toolName: 'view',
              args: { path: 'a.ts' },
              result: 'a',
            },
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-b',
              toolName: 'search',
              args: { pattern: 'x' },
              result: 'b',
            },
          },
        ]),
      ],
    });

    renderChat();

    await waitFor(() => {
      const first = screen.getByRole('group', { name: 'Tool: view' });
      const last = screen.getByRole('group', { name: 'Tool: search' });

      // First card rounds only its top; last card rounds only its bottom, so the
      // pair reads as one container. The shared inner edge becomes a divider
      // (the last card's top border) rather than two abutting rounded borders.
      expect(first.className).toContain('rounded-t-xl');
      expect(first.className).not.toContain('rounded-b-xl');
      expect(last.className).toContain('rounded-b-xl');
      expect(last.className).not.toContain('rounded-t-xl');
      // border-y gives the last card a top edge (the divider from the first card)
      // plus the closing bottom border.
      expect(last.className).toContain('border-y');
    });
  });

  it('separates assistant text persisted after a tool-only message', async () => {
    seedFactory();
    useAgentControllerHandlers({
      messages: [
        dbMessage('assistant-tools', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-complete',
              toolName: 'task_complete',
              args: { id: 'quality-gate' },
              result: 'completed',
            },
          },
        ]),
        dbMessage('completion-signal', 'signal', [{ type: 'text', text: 'Quality gate completed' }]),
        dbMessage('assistant-summary', 'assistant', [{ type: 'text', text: '## Quality gate' }]),
      ],
    });

    renderChat();

    const heading = await screen.findByRole('heading', { name: 'Quality gate' });
    expect(heading.closest('.prose')).toHaveClass('mt-4');
  });

  it('renders assistant text when SSE message updates arrive after subscription', async () => {
    seedFactory();
    const stream = delayedSse({
      type: 'message_update',
      message: dbMessage('assistant-stream', 'assistant', [{ type: 'text', text: 'Streaming now' }]),
    });
    useAgentControllerHandlers();
    server.use(http.get(`${SESSION}/stream`, () => stream.response()));

    renderChat();

    await waitFor(() => expect(screen.getByText('Ready for new conversation')).toBeInTheDocument());
    await new Promise(resolve => setTimeout(resolve, 100));
    await stream.emit();

    await waitFor(() => expect(screen.getByText('Streaming now')).toBeInTheDocument());
  });

  it('renders tool lifecycle events inline before a later message update re-emits the tool part', async () => {
    seedFactory();
    useAgentControllerHandlers({
      events: [
        { type: 'tool_input_start', toolCallId: 'tool-live', toolName: 'execute_command' },
        {
          type: 'tool_input_delta',
          toolCallId: 'tool-live',
          argsTextDelta: '{"command":"pnpm test"}',
          toolName: 'execute_command',
        },
        { type: 'tool_start', toolCallId: 'tool-live', toolName: 'execute_command', args: { command: 'pnpm test' } },
        { type: 'shell_output', toolCallId: 'tool-live', output: 'passing tests', stream: 'stdout' },
        { type: 'tool_end', toolCallId: 'tool-live', result: 'ok' },
      ],
    });

    renderChat();

    const card = await findToolCard('execute_command');
    // Successful tools render no status badge; only running/failed states are labeled.
    expect(within(card).queryByText('Done')).not.toBeInTheDocument();
    expect(within(card).getByText('passing tests')).toBeInTheDocument();
  });

  it('renders status metadata as status UI instead of raw JSON', async () => {
    seedFactory();
    useAgentControllerHandlers({
      messages: [
        {
          id: 'assistant-status',
          role: 'assistant',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [],
            metadata: {
              harnessContent: [{ type: 'om_thread_title_updated', text: 'Thread title updated: Better title' }],
            },
          },
        },
      ],
    });

    renderChat();

    expect(await screen.findByText('Thread title updated: Better title')).toBeInTheDocument();
    expect(screen.queryByText(/om_thread_title_updated/)).not.toBeInTheDocument();
  });

  describe('when a tool has JSON arguments', () => {
    it('shows the argument values when the card is expanded', async () => {
      seedFactory();
      useAgentControllerHandlers({
        messages: [
          dbMessage('assistant-args', 'assistant', [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'tool-args',
                toolName: 'view',
                args: { path: 'src/deep/config.ts' },
                result: 'file contents',
              },
            },
          ]),
        ],
      });

      renderChat();

      const card = await findToolCard('view');
      await userEvent.click(within(card).getByText('view'));

      expect(within(card).getByText(/src\/deep\/config\.ts/)).toBeInTheDocument();
    });
  });

  describe('when a tool approval is required', () => {
    it('renders an approval prompt with approve and decline controls', async () => {
      seedFactory();
      useAgentControllerHandlers({
        events: [
          { type: 'tool_approval_required', toolCallId: 'tool-1', toolName: 'edit', args: { path: 'src/index.ts' } },
        ],
      });

      renderChat();

      const card = await screen.findByRole('group', { name: 'Tool approval for edit' });
      expect(within(card).getByRole('button', { name: 'Approve edit' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Decline edit' })).toBeInTheDocument();
    });
  });

  describe('when a plan approval is suspended', () => {
    it('renders the plan title with approve and reject controls', async () => {
      seedFactory();
      useAgentControllerHandlers({
        events: [
          {
            type: 'tool_suspended',
            toolCallId: 'plan-1',
            toolName: 'submit_plan',
            args: {},
            suspendPayload: { plan: { title: 'Ship the migration', summary: 'Do the thing' } },
          },
        ],
      });

      renderChat();

      const card = await screen.findByRole('group', { name: 'Plan approval' });
      expect(within(card).getByText('Plan: Ship the migration')).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Approve the plan and switch to build' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Reject the plan' })).toBeInTheDocument();
    });
  });

  describe('when an access request is suspended', () => {
    it('renders allow and deny controls for the requested path', async () => {
      seedFactory();
      useAgentControllerHandlers({
        events: [
          {
            type: 'tool_suspended',
            toolCallId: 'access-1',
            toolName: 'request_access',
            args: {},
            suspendPayload: { requestedPath: '/etc/hosts', reason: 'read config' },
          },
        ],
      });

      renderChat();

      const card = await screen.findByRole('group', { name: 'Access request' });
      expect(within(card).getByRole('button', { name: 'Allow access to /etc/hosts' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Deny access to /etc/hosts' })).toBeInTheDocument();
    });
  });

  describe('when the agent asks the user a question', () => {
    it('renders the question with selectable answer options', async () => {
      seedFactory();
      useAgentControllerHandlers({
        events: [
          {
            type: 'tool_suspended',
            toolCallId: 'ask-1',
            toolName: 'ask_user',
            args: {},
            suspendPayload: { question: 'Which database?', options: [{ label: 'Postgres' }, { label: 'SQLite' }] },
          },
        ],
      });

      renderChat();

      const card = await screen.findByRole('group', { name: 'Question from the agent' });
      expect(within(card).getByText('Which database?')).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Postgres' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'SQLite' })).toBeInTheDocument();
    });
  });

  describe('when a subagent is delegated work', () => {
    it('renders a subagent entry with its task', async () => {
      seedFactory();
      useAgentControllerHandlers({
        events: [
          {
            type: 'subagent_start',
            toolCallId: 'sub-1',
            agentType: 'execute',
            task: 'Run the migration',
            modelId: 'openai/gpt-4o-mini',
          },
        ],
      });

      renderChat();

      expect(await screen.findByText('Run the migration')).toBeInTheDocument();
    });
  });

  describe('when a notice contains markdown', () => {
    it('renders the notice text as formatted markdown instead of raw syntax', async () => {
      seedFactory();
      useAgentControllerHandlers({
        events: [{ type: 'info', message: "I'm in **plan mode** — run `/mode build`" }],
      });

      renderChat();

      const bold = await screen.findByText('plan mode');
      expect(bold.tagName).toBe('STRONG');

      const code = screen.getByText('/mode build');
      expect(code.tagName).toBe('CODE');

      expect(screen.queryByText(/\*\*plan mode\*\*/)).not.toBeInTheDocument();
    });

    it('renders fenced code blocks through Shiki while keeping raw HTML escaped', async () => {
      seedFactory();
      useAgentControllerHandlers({
        events: [
          {
            type: 'info',
            message: '```ts\nconst value = 1\n```\n\n<script>alert("xss")</script>',
          },
        ],
      });

      renderChat();

      const code = await screen.findByText(/const/);
      expect(code.closest('pre')).toHaveClass('font-mono');
      expect(code.closest('code')).toHaveClass('language-typescript');
      expect(code.closest('code')?.innerHTML).toContain('style=');
      expect(code.closest('code')?.innerHTML).toContain('color:#005CC5');
      expect(code.closest('code')?.innerHTML).toContain('--shiki-dark:#79C0FF');
      expect(code.closest('code')).toHaveClass('dark:[&_span]:![color:var(--shiki-dark)]');
      expect(code.closest('code')).not.toHaveClass('hljs');

      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
      expect(document.querySelector('script')).not.toBeInTheDocument();
    });
  });

  it('renders edit diffs without highlight.js classes', async () => {
    seedFactory();
    useAgentControllerHandlers({
      messages: [
        dbMessage('assistant-edit', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-edit',
              toolName: 'string_replace',
              args: { path: 'src/example.ts', old_string: 'const value = 1', new_string: 'const value = 2' },
              result: 'updated',
            },
          },
        ]),
      ],
    });

    renderChat();

    const card = await findToolCard('string_replace');
    await userEvent.click(within(card).getByRole('button'));

    const diff = within(card).getByRole('group', { name: 'File change' });
    expect(diff).toHaveClass('font-mono');
    expect(diff).not.toHaveClass('hljs');
    expect(within(diff).getByText('-')).toBeInTheDocument();
    expect(within(diff).getByText('+')).toBeInTheDocument();
    expect(within(diff).getByText('1')).toBeInTheDocument();
    expect(within(diff).getByText('2')).toBeInTheDocument();
  });
});

describe('App mode + theme controls', () => {
  describe('when a project with multiple modes is active', () => {
    function seedMultiMode() {
      seedFactory();
      const handlers = useAgentControllerHandlers();
      server.use(
        http.get(`${API}/modes`, () =>
          HttpResponse.json({
            modes: [
              { id: 'build', name: 'Build' },
              { id: 'plan', name: 'Plan' },
            ],
          }),
        ),
      );
      return handlers;
    }

    it('renders the mode switcher below the composer, not in the header', async () => {
      seedMultiMode();

      renderChat();

      const buildButton = await screen.findByRole('button', { name: 'Build' });
      const planButton = screen.getByRole('button', { name: 'Plan' });
      const composer = screen.getByPlaceholderText(/Ask Mastra Code/);

      // Switcher lives after the composer in DOM order (below it), not in the header.
      expect(composer.compareDocumentPosition(buildButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(composer.compareDocumentPosition(planButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      const header = document.querySelector('header');
      expect(header).not.toBeNull();
      expect(within(header as HTMLElement).queryByRole('button', { name: 'Build' })).not.toBeInTheDocument();
      expect(within(header as HTMLElement).queryByRole('button', { name: 'Plan' })).not.toBeInTheDocument();
    });

    // Detailed mode selection/switching behavior is specified in
    // `domains/chat/components/__tests__/StatusLine.msw.test.tsx`.

    it('does not render a theme toggle in the header', async () => {
      seedMultiMode();

      renderChat();

      await screen.findByRole('button', { name: 'Build' });

      expect(screen.queryByLabelText('Toggle theme')).not.toBeInTheDocument();
    });

    it('does not render a factory switcher in the header', async () => {
      seedMultiMode();

      renderChat();

      await screen.findByRole('button', { name: 'Build' });

      const header = document.querySelector('header');
      expect(header).not.toBeNull();

      // The header must not contain any factory switcher.
      expect(within(header as HTMLElement).queryByRole('button', { name: 'Select factory' })).not.toBeInTheDocument();

      // The sidebar remains the single source of the factory switcher.
      const switcher = screen.getByRole('button', { name: 'Select factory' });
      expect(switcher).toHaveTextContent('MastraCode Test');
      expect(header).not.toContainElement(switcher);
    });

    it('keeps settings in the sidebar without connection status', async () => {
      seedMultiMode();

      renderChat();

      await screen.findByRole('button', { name: 'Build' });

      const header = document.querySelector('header');
      expect(header).not.toBeNull();
      expect(within(header as HTMLElement).queryByRole('button', { name: 'Open settings' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument();
      expect(screen.queryByText('Ready')).not.toBeInTheDocument();
    });

    it('does not duplicate the project name in the status line', async () => {
      seedMultiMode();

      renderChat();

      await screen.findByRole('button', { name: 'Build' });

      const statusLine = screen.getByLabelText('Session status line');
      expect(within(statusLine).queryByText('MastraCode Test')).not.toBeInTheDocument();
    });
  });
});
