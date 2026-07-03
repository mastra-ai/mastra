import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentControllerEvent, AgentControllerMessage, AgentControllerSessionState } from '@mastra/client-js';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import Chat from '../Chat';
import { loginUrl, logoutUrl } from '../domains/auth';
import type { Project } from '../domains/workspaces';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';
const PROJECT_PATH = '/tmp/mastracode-test';

describe('web UI stylesheet entry', () => {
  it('imports the shared Playground UI stylesheet instead of the removed local stylesheet', () => {
    const mainSource = readFileSync(join(process.cwd(), 'src/web/ui/main.tsx'), 'utf8');

    expect(mainSource).toContain("import '@mastra/playground-ui/style.css';");
    expect(mainSource).not.toContain("import './styles.css';");
  });
});

function seedProject() {
  const project: Project = {
    id: 'project-test',
    name: 'MastraCode Test',
    path: PROJECT_PATH,
    resourceId: RESOURCE_ID,
    createdAt: 1,
  };
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
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
  let emit: () => void = () => {};
  let markReady: () => void = () => {};
  const ready = new Promise<void>(resolve => {
    markReady = resolve;
  });
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        emit = () => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        markReady();
      },
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
  return { response, emit: () => ready.then(() => emit()) };
}

function useAgentControllerHandlers({
  messages = [],
  events = [],
}: {
  messages?: AgentControllerMessage[];
  events?: AgentControllerEvent[];
} = {}) {
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get('/auth/me', () => new Response(null, { status: 404 })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages })),
    http.get(`${SESSION}/stream`, () => sse(events)),
  );
}

function useAuthMe(response: Response) {
  server.use(http.get('/auth/me', () => response));
}

function renderSeededApp(authResponse: Response = new Response(null, { status: 404 })) {
  seedProject();
  useAgentControllerHandlers();
  useAuthMe(authResponse);
  return renderWithProviders(<Chat />);
}

/** Locate a migrated tool card by its accessible group label ("Tool: <name>"). */
async function findToolCard(toolName: string): Promise<HTMLElement> {
  return screen.findByRole('group', { name: `Tool: ${toolName}` });
}

afterEach(() => localStorage.clear());

describe('MastraCode sidebar auth actions', () => {
  it('given web auth is disabled, when the app renders, then no auth action appears', async () => {
    renderSeededApp(new Response(null, { status: 404 }));

    await waitFor(() => expect(screen.queryByText('Checking sign-in…')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('given web auth is enabled and unauthenticated, when the app renders, then the sidebar shows no sign-in action', async () => {
    renderSeededApp(HttpResponse.json({ authenticated: false, user: null }));

    await waitFor(() => expect(screen.queryByText('Checking sign-in…')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('given web auth is enabled and authenticated, when the app renders, then the sidebar shows identity and Sign out', async () => {
    renderSeededApp(
      HttpResponse.json({ authenticated: true, user: { name: 'Ada Lovelace', email: 'ada@example.com' } }),
    );

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('given an unauthenticated user, when the login URL is generated, then it preserves the current route', () => {
    window.history.replaceState(null, '', '/projects?thread=abc');

    expect(loginUrl()).toBe('/auth/login?returnTo=%2Fprojects%3Fthread%3Dabc');
  });

  it('given an explicit returnTo, when the login URL is generated, then it targets that destination', () => {
    expect(loginUrl('/chat')).toBe('/auth/login?returnTo=%2Fchat');
  });

  it('given an authenticated user, when the logout URL is generated, then it targets the logout route', () => {
    expect(logoutUrl()).toBe('/auth/logout');
  });
});

describe('MastraCode empty thread state', () => {
  it('given a project with no messages, when the app renders, then the Mastra Code wordmark hero appears', async () => {
    renderSeededApp();

    expect(await screen.findByText('Ready for new conversation')).toBeInTheDocument();
    const wordmark = screen.getByLabelText('Mastra Code');
    expect(wordmark).toBeInTheDocument();
    // The hero sits inside the transcript scroller, which centers empty content vertically.
    expect(wordmark.closest('.place-items-center')).not.toBeNull();
  });
});

describe('MastraCode message rendering', () => {
  it('renders hydrated persisted text, thinking, and tool content through Mastra message parts', async () => {
    seedProject();
    useAgentControllerHandlers({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'text', text: '**Hello** from hydrate' },
            { type: 'thinking', thinking: 'checking files' },
            { type: 'tool_call', id: 'tool-1', name: 'view', args: { path: 'README.md' } },
            { type: 'tool_result', id: 'tool-1', name: 'view', result: 'readme contents' },
          ],
        },
      ],
    });

    renderWithProviders(<Chat />);

    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('from hydrate')).toBeInTheDocument();
    expect(screen.getByText('checking files')).toBeInTheDocument();
    const card = await findToolCard('view');
    expect(within(card).getByText('Done')).toBeInTheDocument();
  });

  it('composes consecutive tool cards into a single bordered container', async () => {
    seedProject();
    useAgentControllerHandlers({
      messages: [
        {
          id: 'assistant-tools',
          role: 'assistant',
          content: [
            { type: 'tool_call', id: 'tool-a', name: 'view', args: { path: 'a.ts' } },
            { type: 'tool_result', id: 'tool-a', name: 'view', result: 'a' },
            { type: 'tool_call', id: 'tool-b', name: 'search', args: { pattern: 'x' } },
            { type: 'tool_result', id: 'tool-b', name: 'search', result: 'b' },
          ],
        },
      ],
    });

    renderWithProviders(<Chat />);

    const first = await findToolCard('view');
    const last = await findToolCard('search');

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

  it('renders assistant text when SSE message updates arrive after subscription', async () => {
    seedProject();
    const stream = delayedSse({
      type: 'message_update',
      message: { id: 'assistant-stream', role: 'assistant', content: [{ type: 'text', text: 'Streaming now' }] },
    });
    useAgentControllerHandlers();
    server.use(http.get(`${SESSION}/stream`, () => stream.response));

    renderWithProviders(<Chat />);

    expect(await screen.findByText('Ready')).toBeInTheDocument();
    await stream.emit();

    expect(await screen.findByText('Streaming now')).toBeInTheDocument();
  });

  it('renders tool lifecycle events inline before a later message update re-emits the tool part', async () => {
    seedProject();
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

    renderWithProviders(<Chat />);

    const card = await findToolCard('execute_command');
    expect(within(card).getByText('Done')).toBeInTheDocument();
    expect(within(card).getByText('passing tests')).toBeInTheDocument();
  });

  it('renders status metadata as status UI instead of raw JSON', async () => {
    seedProject();
    useAgentControllerHandlers({
      messages: [
        {
          id: 'assistant-status',
          role: 'assistant',
          content: [{ type: 'om_thread_title_updated', text: 'Thread title updated: Better title' }],
        },
      ],
    });

    renderWithProviders(<Chat />);

    expect(await screen.findByText('Thread title updated: Better title')).toBeInTheDocument();
    expect(screen.queryByText(/om_thread_title_updated/)).not.toBeInTheDocument();
  });

  describe('when a tool has JSON arguments', () => {
    it('shows the argument values when the card is expanded', async () => {
      seedProject();
      useAgentControllerHandlers({
        messages: [
          {
            id: 'assistant-args',
            role: 'assistant',
            content: [
              { type: 'tool_call', id: 'tool-args', name: 'view', args: { path: 'src/deep/config.ts' } },
              { type: 'tool_result', id: 'tool-args', name: 'view', result: 'file contents' },
            ],
          },
        ],
      });

      renderWithProviders(<Chat />);

      const card = await findToolCard('view');
      await userEvent.click(within(card).getByText('view'));

      expect(within(card).getByText(/src\/deep\/config\.ts/)).toBeInTheDocument();
    });
  });

  describe('when a tool approval is required', () => {
    it('renders an approval prompt with approve and decline controls', async () => {
      seedProject();
      useAgentControllerHandlers({
        events: [
          { type: 'tool_approval_required', toolCallId: 'tool-1', toolName: 'edit', args: { path: 'src/index.ts' } },
        ],
      });

      renderWithProviders(<Chat />);

      const card = await screen.findByRole('group', { name: 'Tool approval for edit' });
      expect(within(card).getByRole('button', { name: 'Approve edit' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Decline edit' })).toBeInTheDocument();
    });
  });

  describe('when a plan approval is suspended', () => {
    it('renders the plan title with approve and reject controls', async () => {
      seedProject();
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

      renderWithProviders(<Chat />);

      const card = await screen.findByRole('group', { name: 'Plan approval' });
      expect(within(card).getByText('Plan: Ship the migration')).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Approve the plan and switch to build' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Reject the plan' })).toBeInTheDocument();
    });
  });

  describe('when an access request is suspended', () => {
    it('renders allow and deny controls for the requested path', async () => {
      seedProject();
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

      renderWithProviders(<Chat />);

      const card = await screen.findByRole('group', { name: 'Access request' });
      expect(within(card).getByRole('button', { name: 'Allow access to /etc/hosts' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Deny access to /etc/hosts' })).toBeInTheDocument();
    });
  });

  describe('when the agent asks the user a question', () => {
    it('renders the question with selectable answer options', async () => {
      seedProject();
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

      renderWithProviders(<Chat />);

      const card = await screen.findByRole('group', { name: 'Question from the agent' });
      expect(within(card).getByText('Which database?')).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Postgres' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'SQLite' })).toBeInTheDocument();
    });
  });

  describe('when a subagent is delegated work', () => {
    it('renders a subagent entry with its task', async () => {
      seedProject();
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

      renderWithProviders(<Chat />);

      expect(await screen.findByText('Run the migration')).toBeInTheDocument();
    });
  });

  describe('when a goal evaluation arrives', () => {
    it('renders the goal panel with its objective and controls', async () => {
      seedProject();
      useAgentControllerHandlers({
        events: [
          {
            type: 'goal_evaluation',
            payload: { objective: 'Migrate the UI', status: 'active', iteration: 1, maxRuns: 5, passed: false },
          },
        ],
      });

      renderWithProviders(<Chat />);

      expect(await screen.findByText('Migrate the UI')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    });
  });

  describe('when a notice contains markdown', () => {
    it('renders the notice text as formatted markdown instead of raw syntax', async () => {
      seedProject();
      useAgentControllerHandlers({
        events: [{ type: 'info', message: "I'm in **plan mode** — run `/mode build`" }],
      });

      renderWithProviders(<Chat />);

      const bold = await screen.findByText('plan mode');
      expect(bold.tagName).toBe('STRONG');

      const code = screen.getByText('/mode build');
      expect(code.tagName).toBe('CODE');

      expect(screen.queryByText(/\*\*plan mode\*\*/)).not.toBeInTheDocument();
    });

    it('renders fenced code blocks through Shiki while keeping raw HTML escaped', async () => {
      seedProject();
      useAgentControllerHandlers({
        events: [
          {
            type: 'info',
            message: '```ts\nconst value = 1\n```\n\n<script>alert("xss")</script>',
          },
        ],
      });

      renderWithProviders(<Chat />);

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
    seedProject();
    useAgentControllerHandlers({
      messages: [
        {
          id: 'assistant-edit',
          role: 'assistant',
          content: [
            {
              type: 'tool_call',
              id: 'tool-edit',
              name: 'string_replace',
              args: { path: 'src/example.ts', old_string: 'const value = 1', new_string: 'const value = 2' },
            },
            { type: 'tool_result', id: 'tool-edit', name: 'string_replace', result: 'updated' },
          ],
        },
      ],
    });

    renderWithProviders(<Chat />);

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
      seedProject();
      useAgentControllerHandlers();
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
    }

    it('renders the mode switcher below the composer, not in the header', async () => {
      seedMultiMode();

      renderWithProviders(<Chat />);

      const buildButton = await screen.findByRole('button', { name: 'Build' });
      const planButton = screen.getByRole('button', { name: 'Plan' });
      const composer = screen.getByRole('textbox');

      // Switcher lives after the composer in DOM order (below it), not in the header.
      expect(composer.compareDocumentPosition(buildButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(composer.compareDocumentPosition(planButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      const header = document.querySelector('header');
      expect(header).not.toBeNull();
      expect(within(header as HTMLElement).queryByRole('button', { name: 'Build' })).not.toBeInTheDocument();
      expect(within(header as HTMLElement).queryByRole('button', { name: 'Plan' })).not.toBeInTheDocument();
    });

    it('marks the active mode as selected', async () => {
      seedMultiMode();

      renderWithProviders(<Chat />);

      const buildButton = await screen.findByRole('button', { name: 'Build' });
      const planButton = screen.getByRole('button', { name: 'Plan' });

      expect(buildButton).toHaveAttribute('aria-pressed', 'true');
      expect(planButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('does not render a theme toggle in the header', async () => {
      seedMultiMode();

      renderWithProviders(<Chat />);

      await screen.findByRole('button', { name: 'Build' });

      expect(screen.queryByLabelText('Toggle theme')).not.toBeInTheDocument();
    });

    it('does not render a project switcher in the header', async () => {
      seedMultiMode();

      renderWithProviders(<Chat />);

      await screen.findByRole('button', { name: 'Build' });

      const header = document.querySelector('header');
      expect(header).not.toBeNull();

      // The header must not contain any project switcher.
      expect(within(header as HTMLElement).queryByRole('button', { name: /MastraCode Test/ })).not.toBeInTheDocument();

      // The sidebar remains the single source of the project switcher: exactly
      // one project-switcher button exists, it exposes the project name, and it
      // lives outside the header.
      const switchers = screen.getAllByRole('button', { name: /MastraCode Test/ });
      expect(switchers).toHaveLength(1);
      expect(header).not.toContainElement(switchers[0]);
    });

    it('renders the ready status above settings in the sidebar', async () => {
      seedMultiMode();

      renderWithProviders(<Chat />);

      await screen.findByRole('button', { name: 'Build' });

      const header = document.querySelector('header');
      expect(header).not.toBeNull();
      expect(within(header as HTMLElement).queryByRole('button', { name: 'Open settings' })).not.toBeInTheDocument();

      const settings = screen.getByRole('button', { name: 'Open settings' });
      const readyStatus = screen.getByRole('status', { name: '' });
      expect(readyStatus).toHaveTextContent('Ready');
      expect(readyStatus.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('does not duplicate the project name in the status line', async () => {
      seedMultiMode();

      renderWithProviders(<Chat />);

      await screen.findByRole('button', { name: 'Build' });

      const statusLine = screen.getByLabelText('Session status line');
      expect(within(statusLine).queryByText('MastraCode Test')).not.toBeInTheDocument();
    });
  });
});
