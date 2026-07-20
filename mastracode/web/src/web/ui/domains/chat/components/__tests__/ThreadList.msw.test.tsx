/**
 * BDD coverage for the propless `ThreadList` (`domains/chat/components`).
 *
 * The list owns the thread-section behavior end-to-end: it reads threads from
 * focused chat hooks, gates itself on the active factory, closes the sidebar
 * drawer on navigation, and toasts on thread CRUD. Driven through the real
 * fetch transport with MSW at the network boundary.
 */
import type { AgentControllerSessionState, AgentControllerThreadInfo } from '@mastra/client-js';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../context/ChatSessionTestProvider';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { OverlaysProvider, useOverlays } from '../../../../lib/overlays';
import { ToastProvider } from '../../../../ui';
import type { Factory } from '../../../workspaces';
import { ActiveFactoryProvider } from '../../../workspaces';
import { ThreadList } from '../ThreadList';

const RESOURCE_ID = 'res-alpha';
const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const SESSION = `${API}/sessions/${RESOURCE_ID}`;

const project: Factory = {
  id: 'p-alpha',
  name: 'Alpha',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/projects/alpha',
  },
};

/** GitHub project with a feature worktree selected — thread list is read-only. */
const worktreeProject: Factory = {
  id: 'p-gh',
  name: 'Mastra',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'github',
    githubProjectId: 'gh-1',
    gitBranch: 'main',
    sandboxWorkdir: '/sandbox/mastra',
    selectedWorktreePath: '/sandbox/mastra-worktrees/feat-ui',
    worktrees: [
      { branch: 'main', worktreePath: '/sandbox/mastra', baseBranch: 'main' },
      { branch: 'feat-ui', worktreePath: '/sandbox/mastra-worktrees/feat-ui', baseBranch: 'main' },
    ],
  },
};

function thread(id: string, title: string, updatedAt: string): AgentControllerThreadInfo {
  return { id, title, resourceId: RESOURCE_ID, createdAt: '2026-06-01T00:00:00.000Z', updatedAt };
}

const threadOne = thread('thread-one', 'First thread', '2026-06-02T00:00:00.000Z');
const threadTwo = thread('thread-two', 'Second thread', '2026-06-04T00:00:00.000Z');

afterEach(() => {
  localStorage.clear();
});

function seedFactory(seeded: Factory = project) {
  localStorage.setItem('mastracode-factories', JSON.stringify([seeded]));
  localStorage.setItem('mastracode-active-factory', seeded.id);
}

function sessionState(): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: threadOne.id,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function sse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

interface CapturedRequests {
  switched: string[];
  created: number;
  deleted: string[];
  renamed: Array<{ threadId: string; title: string }>;
  cloned: Array<Record<string, unknown>>;
}

function useAgentControllerHandlers(threads: AgentControllerThreadInfo[]): CapturedRequests {
  const captured: CapturedRequests = { switched: [], created: 0, deleted: [], renamed: [], cloned: [] };
  const newThread = thread('thread-new', 'New thread', '2026-06-05T00:00:00.000Z');

  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: threadOne.id }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads })),
    http.get(`${SESSION}/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse()),
    http.post(`${SESSION}/thread`, async ({ request }) => {
      captured.switched.push(((await request.json()) as { threadId: string }).threadId);
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${SESSION}/threads`, () => {
      captured.created += 1;
      return HttpResponse.json(newThread);
    }),
    http.post(`${SESSION}/threads/clone`, async ({ request }) => {
      captured.cloned.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(newThread);
    }),
    http.delete(`${SESSION}/threads/:threadId`, ({ params }) => {
      captured.deleted.push(String(params.threadId));
      return HttpResponse.json({ ok: true });
    }),
    http.put(`${SESSION}/threads/:threadId`, async ({ params, request }) => {
      captured.renamed.push({
        threadId: String(params.threadId),
        title: ((await request.json()) as { title: string }).title,
      });
      return HttpResponse.json({ ok: true });
    }),
  );

  return captured;
}

function SidebarOverlayProbe() {
  const overlays = useOverlays();
  return (
    <div>
      <span data-testid="sidebar-open">{overlays.isOpen('sidebar') ? 'yes' : 'no'}</span>
      <button onClick={() => overlays.open('sidebar')}>open sidebar</button>
    </div>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderThreadList() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/chat']}>
      <ToastProvider>
        <ActiveFactoryProvider>
          <ChatSessionProvider>
            <OverlaysProvider>
              <ThreadList />
              <SidebarOverlayProbe />
              <LocationProbe />
            </OverlaysProvider>
          </ChatSessionProvider>
        </ActiveFactoryProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function openThreadActions(title: string) {
  await screen.findByText(title);
  const row = screen.getAllByRole('listitem').find(item => within(item).queryByText(title));
  if (!row) throw new Error(`Thread row not found: ${title}`);
  await userEvent.click(within(row).getByRole('button', { name: 'Thread actions' }));
}

describe('ThreadList', () => {
  it('given no active factory, then nothing renders', () => {
    useAgentControllerHandlers([]);
    renderThreadList();

    expect(screen.queryByText('Threads')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('given threads, then every fetched thread renders sorted by updatedAt desc', async () => {
    seedFactory();
    const threads = [
      thread('t1', 'Thread 1', '2026-06-01T00:00:00.000Z'),
      thread('t2', 'Thread 2', '2026-06-02T00:00:00.000Z'),
      thread('t3', 'Thread 3', '2026-06-03T00:00:00.000Z'),
      thread('t4', 'Thread 4', '2026-06-04T00:00:00.000Z'),
      thread('t5', 'Thread 5', '2026-06-05T00:00:00.000Z'),
      thread('t6', 'Thread 6', '2026-06-06T00:00:00.000Z'),
      thread('t7', 'Thread 7', '2026-06-07T00:00:00.000Z'),
    ];
    useAgentControllerHandlers(threads);
    renderThreadList();

    expect(await screen.findByText('Thread 7')).toBeInTheDocument();
    const titles = within(screen.getByRole('list'))
      .getAllByRole('listitem')
      .map(item => within(item).getByRole('button', { name: /Thread \d/ }).textContent);
    expect(titles.map(t => t?.slice(0, 8))).toEqual([
      'Thread 7',
      'Thread 6',
      'Thread 5',
      'Thread 4',
      'Thread 3',
      'Thread 2',
      'Thread 1',
    ]);
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it('given a feature worktree is active, then thread titles render read-only without actions or a new-thread control', async () => {
    seedFactory(worktreeProject);
    useAgentControllerHandlers([threadOne]);
    renderThreadList();

    // The title still shows for context…
    expect(await screen.findByText('First thread')).toBeInTheDocument();
    // …but no "Threads" header/count and no way to create, rename, clone, or delete threads.
    expect(screen.queryByText('Threads')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New thread' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thread actions' })).not.toBeInTheDocument();
  });

  it('given a GitHub project, then the list is read-only even when the repo-root path was persisted as selected', async () => {
    // Legacy projects could persist the repo root as the selected worktree;
    // it is no longer a workspace, so GitHub lists never expose thread controls.
    seedFactory({
      ...worktreeProject,
      binding: { ...worktreeProject.binding, selectedWorktreePath: '/sandbox/mastra' },
    });
    useAgentControllerHandlers([threadOne]);
    renderThreadList();

    expect(await screen.findByText('First thread')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New thread' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thread actions' })).not.toBeInTheDocument();
  });

  it('when a thread is clicked, then the app navigates to its page and the sidebar closes', async () => {
    seedFactory();
    useAgentControllerHandlers([threadOne, threadTwo]);
    renderThreadList();

    await userEvent.click(screen.getByRole('button', { name: 'open sidebar' }));
    await userEvent.click(await screen.findByText('Second thread'));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-two'));
    expect(screen.getByTestId('sidebar-open')).toHaveTextContent('no');
  });

  it('when "New thread" is clicked, then it opens the /new draft page without persisting a thread and the sidebar closes', async () => {
    seedFactory();
    const captured = useAgentControllerHandlers([threadOne]);
    renderThreadList();

    await screen.findByText('First thread');
    await userEvent.click(screen.getByRole('button', { name: 'open sidebar' }));
    await userEvent.click(screen.getByRole('button', { name: 'New thread' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/new'));
    expect(captured.created).toBe(0);
    expect(screen.getByTestId('sidebar-open')).toHaveTextContent('no');
  });

  it('when a rename is committed with Enter, then the rename request fires with the new title and a toast shows', async () => {
    seedFactory();
    const captured = useAgentControllerHandlers([threadOne]);
    renderThreadList();

    await openThreadActions('First thread');
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));

    const input = screen.getByRole('textbox', { name: 'Thread title' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed thread{Enter}');

    await waitFor(() => expect(captured.renamed).toEqual([{ threadId: 'thread-one', title: 'Renamed thread' }]));
    expect(await screen.findByText('Thread renamed')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Thread title' })).not.toBeInTheDocument();
  });

  it('when a rename is cancelled with Escape, then no rename request fires', async () => {
    seedFactory();
    const captured = useAgentControllerHandlers([threadOne]);
    renderThreadList();

    await openThreadActions('First thread');
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));

    const input = screen.getByRole('textbox', { name: 'Thread title' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Never sent{Escape}');

    expect(await screen.findByText('First thread')).toBeInTheDocument();
    expect(captured.renamed).toEqual([]);
  });

  it('when Clone is picked, then the clone request fires and a toast shows', async () => {
    seedFactory();
    const captured = useAgentControllerHandlers([threadOne]);
    renderThreadList();

    await openThreadActions('First thread');
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Clone' }));

    await waitFor(() => expect(captured.cloned).toHaveLength(1));
    expect(captured.cloned[0]).toMatchObject({ sourceThreadId: 'thread-one' });
    expect(await screen.findByText('Thread cloned')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-new'));
  });

  it('when Delete is picked, then the delete request fires and a toast shows', async () => {
    seedFactory();
    const captured = useAgentControllerHandlers([threadOne, threadTwo]);
    renderThreadList();

    await openThreadActions('Second thread');
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    await waitFor(() => expect(captured.deleted).toEqual(['thread-two']));
    expect(await screen.findByText('Thread deleted')).toBeInTheDocument();
  });

  it('when the actions menu is open, then clicking the trigger again closes it', async () => {
    seedFactory();
    useAgentControllerHandlers([threadOne]);
    renderThreadList();

    await openThreadActions('First thread');
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await openThreadActions('First thread');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});
